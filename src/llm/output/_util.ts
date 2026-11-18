import { GenericFunctionCall, OutputResultContent } from "@/interfaces";

export function normalizeFunctionCall(
  input: GenericFunctionCall,
  provider: "openai" | "anthropic" | "google"
) {
  if (input === "any") {
    if (provider === "openai") {
      return "required";
    }
  }

  return input;
}

export function normalizeFinishReason(input: string) {
  const map = {
    stop: ["stop", "end_turn"],
    tool: ["tool_use", "tool_use"],
  };

  const options = Object.keys(map) as (keyof typeof map)[];

  for (const option of options) {
    if (map[option].includes(input)) {
      return option;
    }
  }

  return "unknown";
}

export function formatOptions(response: any[], handler: (i: any) => any) {
  const out: OutputResultContent[][] = [];
  for (const item of response) {
    const result = handler(item);
    if (result) {
      out.push(result);
    }
  }
  return out;
}

export function formatContent(response: any[number], handler: (i: any) => any) {
  const out: OutputResultContent[] = [];
  const result = handler(response);
  if (result) {
    out.push(result);
  }
  return out;
}
