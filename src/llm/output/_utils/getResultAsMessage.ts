import { OutputResultContent } from "@/interfaces";
import { LlmExeError } from "@/errors";

export function getResultAsMessage(content: OutputResultContent[]) {
  if (content.length === 1 && content.every((a) => a.type === "text")) {
    return {
      role: "assistant",
      content: content[0]?.text || "",
    };
  }
  if (content.length === 1 && content.every((a) => a.type === "function_use")) {
    return {
      role: "assistant",
      content: null,
      function_call: JSON.stringify(
        content.find((a) => a.type === "function_use")
      ),
    };
  }
  if (
    content.length === 2 &&
    content.find((a) => a.type === "text") &&
    content.find((a) => a.type === "function_use")
  ) {
    return {
      role: "assistant",
      content: content.find((a) => a.type === "text")?.text,
      function_call: JSON.stringify(
        content.find((a) => a.type === "function_use")
      ),
    };
  }
  // provider and model are not available at this site — they live on the
  // caller (provider-specific output transforms). Add them in a future pass
  // that touches the caller boundary.
  let responseExcerpt: string | undefined;
  try {
    responseExcerpt = JSON.stringify(content).slice(0, 500);
  } catch {
    responseExcerpt = undefined;
  }
  throw new LlmExeError("Invalid response", {
    code: "llm.invalid_response_shape",
    context: {
      operation: "getResultAsMessage",
      expected:
        "single text item, single function_use item, or text + function_use pair",
      received: {
        count: content.length,
        types: content.map((a) => a?.type),
      },
      responseExcerpt,
      resolution:
        "Check provider response normalization for unexpected content shapes.",
    },
  });
}