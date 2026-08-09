import { LlmExeError } from "@/errors";
import { Config } from "@/types";
import { cleanJsonSchemaFor } from "@/llm/output/_utils/cleanJsonSchemaFor";

// A forced tool_choice is one that requires the model to call a tool: "any", or a
// named tool ({ name }). "auto" and "none" do not force a tool call.
const isForcedToolChoice = (call: unknown): boolean =>
  call === "any" ||
  (typeof call === "object" &&
    call !== null &&
    typeof (call as { name?: unknown }).name === "string");

/**
 * Maps the executor's `functionCall` to Anthropic's `tool_choice`. Shared by the
 * direct Anthropic (anthropic.chat) and Bedrock (amazon:anthropic.chat) configs —
 * the tool_choice shape is identical on both.
 *
 * `currentInput` is the already-mapped request body (mapOptions runs after
 * mapBody), so `currentInput.thinking` reflects what `effort` produced. Anthropic
 * rejects a forced tool_choice together with **extended** thinking
 * (`thinking.type: "enabled"`, the 4.5 `budget_tokens` path that `effort`
 * produces) — the API 400s with "Thinking may not be enabled when tool_choice
 * forces tool use." Adaptive thinking (`type: "adaptive"`, the 4.6+/5 path) does
 * NOT carry this restriction on the direct API, so it is intentionally allowed.
 * We fail fast with an actionable error rather than let the request 400 (#720).
 */
export const anthropicFunctionCall = (
  call: any,
  _options?: any,
  currentInput?: Record<string, any>,
  config?: Config
): Record<string, any> => {
  // Anthropic handles "none" by clearing the functions array.
  if (call === "none") return { _clearFunctions: true };

  if (isForcedToolChoice(call) && currentInput?.thinking?.type === "enabled") {
    throw new LlmExeError(
      `A forced tool_choice ("any" or a named tool) is not allowed together with extended thinking, which \`effort\` enables on this model. Use functionCall "auto" (or "none"), or omit \`effort\`.`,
      {
        code: "configuration.incompatible_options",
        context: {
          operation: "anthropicFunctionCall",
          provider: config?.provider,
          received: `functionCall ${
            typeof call === "string" ? `"${call}"` : JSON.stringify(call)
          } with extended thinking enabled by effort`,
          expected:
            'functionCall "auto" or "none" when effort enables extended thinking',
          resolution:
            'Set functionCall to "auto" (or "none"), or remove effort for this request.',
        },
      }
    );
  }

  if (call === "auto" || call === "any") {
    return { tool_choice: { type: call } };
  }

  // Named tool: Anthropic requires { type: "tool", name }. A bare { name } (the
  // public GenericFunctionCall shape) would otherwise be forwarded without the
  // required `type`, which the API rejects.
  if (
    typeof call === "object" &&
    call !== null &&
    typeof call.name === "string"
  ) {
    return { tool_choice: { type: "tool", name: call.name } };
  }

  // Unexpected shape: forward as-is rather than guess.
  return { tool_choice: call };
};

export const anthropicFunctions = (
  functions: any[]
): Record<string, any> => ({
  tools: functions.map((f) => ({
    name: f.name,
    description: f.description,
    input_schema: cleanJsonSchemaFor(f.parameters, "anthropic.chat"),
  })),
});
