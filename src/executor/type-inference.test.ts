import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";
import { createParser, createCustomParser } from "@/parser";
import { createLlmExecutor } from "@/executor";

/**
 * Compile-time guarantees for the chain CLAUDE.md calls non-negotiable:
 * prompt input -> parser output -> executor return type.
 *
 * Runtime coverage cannot protect this. A regression that widens a generic to
 * `any`, or breaks the parser -> executor inference link, still returns the
 * correct values at runtime, so every behavioural test keeps passing while the
 * library's main value proposition is silently gone. These assertions fail at
 * `tsc` time instead.
 */

// Invariant equality — `Equal<any, string>` is false, so widening to `any`
// (the most likely regression) is caught rather than silently accepted.
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false;

/**
 * Only accepts `true`. Called in value position so `noUnusedLocals` does not
 * flag the assertions the way a bare `type _X = ...` alias would.
 */
function assertType<_T extends true>(): void {}

/** Fails to compile if `T` is (or contains) `any`. */
type IsNotAny<T> = 0 extends 1 & T ? false : true;

const llm = useLlm("openai.chat-mock.v1", { model: "something" });

describe("end-to-end type inference", () => {
  it("infers the executor return type from the parser", async () => {
    const executor = createLlmExecutor({
      llm,
      prompt: createChatPrompt<{ text: string }>("- alpha\n- beta\n- {{text}}"),
      parser: createParser("listToArray"),
    });

    // Asserted on the signature rather than a call: the mock provider echoes a
    // fixed single-line string, which listToArray rejects at runtime. The
    // inference link being tested here is static either way.
    type Result = Awaited<ReturnType<typeof executor.execute>>;

    assertType<IsNotAny<Result>>();
    assertType<Equal<Result, string[]>>();

    expect(typeof executor.execute).toBe("function");
  });

  it("threads a custom parser's generic through to the executor", async () => {
    type Sentiment = { score: number; label: string };

    const executor = createLlmExecutor({
      llm,
      prompt: createChatPrompt<{ review: string }>("Rate: {{review}}"),
      parser: createCustomParser<Sentiment>("sentiment", () => ({
        score: 1,
        label: "positive",
      })),
    });

    const result = await executor.execute({ review: "great" });

    assertType<IsNotAny<typeof result>>();
    assertType<Equal<typeof result, Sentiment>>();

    // Property access compiles only because the generic survived the chain.
    expect(result.label).toBe("positive");
    expect(result.score).toBe(1);
  });

  it("keeps distinct parsers from collapsing to a single type", async () => {
    const asString = createLlmExecutor({
      llm,
      prompt: createChatPrompt("Say something."),
      parser: createParser("string"),
    });
    const asNumber = createLlmExecutor({
      llm,
      prompt: createChatPrompt("Count something."),
      parser: createParser("number"),
    });
    const asBoolean = createLlmExecutor({
      llm,
      prompt: createChatPrompt("Decide something."),
      parser: createParser("boolean"),
    });

    type S = Awaited<ReturnType<typeof asString.execute>>;
    type N = Awaited<ReturnType<typeof asNumber.execute>>;
    type B = Awaited<ReturnType<typeof asBoolean.execute>>;

    assertType<Equal<S, string>>();
    assertType<Equal<N, number>>();
    assertType<Equal<B, boolean>>();

    // If any of the three degraded to `any`/`unknown` they would compare equal.
    assertType<Equal<Equal<S, N>, false>>();

    expect(typeof (await asString.execute({}))).toBe("string");
  });

  it("type-checks prompt input against the prompt generic", async () => {
    const executor = createLlmExecutor({
      llm,
      prompt: createChatPrompt<{ name: string; age: number }>(
        "{{name}} is {{age}}",
      ),
      parser: createParser("string"),
    });

    type Input = Parameters<typeof executor.execute>[0];

    assertType<IsNotAny<Input>>();
    assertType<Equal<Input["name"], string>>();
    assertType<Equal<Input["age"], number>>();

    // @ts-expect-error - `age` must be a number, not a string.
    await executor.execute({ name: "ada", age: "36" });

    // @ts-expect-error - `name` is required.
    await executor.execute({ age: 36 });

    await expect(executor.execute({ name: "ada", age: 36 })).resolves.toEqual(
      expect.any(String),
    );
  });

  it("preserves inference when one executor's output feeds another", async () => {
    const first = createLlmExecutor({
      llm,
      prompt: createChatPrompt<{ text: string }>("Extract from: {{text}}"),
      parser: createCustomParser<string[]>("splitter", (raw) =>
        String(raw).split(" "),
      ),
    });

    const items = await first.execute({ text: "a, b, c" });

    const second = createLlmExecutor({
      llm,
      prompt: createChatPrompt<{ joined: string }>("Rank: {{joined}}"),
      parser: createParser("string"),
    });

    // Compiles only because `items` is known to be string[].
    const ranked = await second.execute({ joined: items.join(", ") });

    assertType<Equal<typeof ranked, string>>();

    expect(typeof ranked).toBe("string");
  });
});
