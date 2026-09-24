import { useLlm } from "@/llm";
import { createChatPrompt } from "@/prompt";
import { createParser, createCustomParser } from "@/parser";
import { createLlmExecutor } from "@/executor";
import { BaseLlCall } from "@/types";

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

    // Distinct parsers must not resolve to the same type.
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

/**
 * `.on()` / `.once()` / `.off()` used to accept `ListenerFunction`
 * (`(...args: any[]) => void`), which made the execution metadata `any` on that
 * path while the `hooks` option inferred it correctly. Without the fix these
 * assertions fail at `tsc` time (the `Equal<..., any>` checks resolve to
 * `false`, and the `@ts-expect-error` below becomes unused), so this is the
 * regression guard for the two registration paths staying in sync.
 */
describe("hook registration type inference", () => {
  const executor = createLlmExecutor({
    llm,
    prompt: createChatPrompt<{ text: string }>("Summarize: {{text}}"),
    parser: createParser("listToArray"),
  });

  type OnHook = Parameters<typeof executor.on>[1];
  type OnceHook = Parameters<typeof executor.once>[1];
  type OffHook = Parameters<typeof executor.off>[1];
  type Metadata = Parameters<OnHook>[0];

  it("types the metadata a hook registered with .on() receives", () => {
    assertType<IsNotAny<Metadata>>();
    assertType<Equal<Metadata["input"], { text: string }>>();
    assertType<Equal<NonNullable<Metadata["output"]>, string[]>>();
    assertType<Equal<NonNullable<Metadata["handlerOutput"]>, BaseLlCall>>();
    assertType<IsNotAny<NonNullable<Metadata["handlerInput"]>>>();

    // The payoff from `handlerOutput` being pinned: usage is reachable with
    // types rather than through `any`.
    type Usage = ReturnType<
      NonNullable<Metadata["handlerOutput"]>["getResult"]
    >["usage"];
    assertType<IsNotAny<Usage>>();

    // The second argument is the executor's own identity metadata.
    assertType<Equal<Parameters<OnHook>[1]["name"], string>>();

    expect(typeof executor.on).toBe("function");
  });

  it("uses one signature across .on(), .once() and .off()", () => {
    assertType<Equal<OnHook, OnceHook>>();
    assertType<Equal<OnHook, OffHook>>();

    expect(typeof executor.once).toBe("function");
  });

  it("infers metadata inside an inline .on() callback", async () => {
    const stringExecutor = createLlmExecutor({
      llm,
      prompt: createChatPrompt<{ text: string }>("Say: {{text}}"),
      parser: createParser("string"),
    });

    const seen: { input: string; output: string }[] = [];

    stringExecutor.on("onComplete", (exec, executorMetadata) => {
      // Nothing is annotated here — this only compiles via contextual typing
      // from the `.on()` signature.
      assertType<Equal<typeof exec.input, { text: string }>>();
      assertType<Equal<NonNullable<typeof exec.output>, string>>();
      assertType<Equal<typeof executorMetadata.name, string>>();

      // @ts-expect-error - a typo'd property is now a compile error.
      const typo = exec.hanlderOutput;
      expect(typo).toBeUndefined();

      seen.push({ input: exec.input.text, output: exec.output ?? "" });
    });

    await stringExecutor.execute({ text: "hello" });

    expect(seen).toHaveLength(1);
    expect(seen[0].input).toBe("hello");
    expect(typeof seen[0].output).toBe("string");
  });

  it("accepts the same callback shape through both registration paths", () => {
    const hooked = createLlmExecutor(
      {
        llm,
        prompt: createChatPrompt<{ text: string }>("Say: {{text}}"),
        parser: createParser("string"),
      },
      {
        hooks: {
          onComplete: (exec) => {
            assertType<Equal<typeof exec.input, { text: string }>>();
          },
        },
      },
    );

    hooked.on("onComplete", (exec) => {
      assertType<Equal<typeof exec.input, { text: string }>>();
    });

    expect(hooked.hooks.onComplete).toHaveLength(2);
  });
});
