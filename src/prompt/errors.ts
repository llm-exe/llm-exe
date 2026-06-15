import { createLlmExeError } from "@/errors";
import type {
  LlmExeError,
  PromptMissingTemplateVariableContext,
} from "@/errors";
import { formatErrorList } from "@/errors";

function buildMessage(context: PromptMissingTemplateVariableContext): string {
  const { missingVariables, missingHelpers } = context;
  const vars = missingVariables.length
    ? `Missing variables: ${formatErrorList(missingVariables)}.`
    : "";
  const helpers = missingHelpers.length
    ? `Missing helpers: ${formatErrorList(missingHelpers)}.`
    : "";
  if (vars && helpers) {
    return `Prompt template has unresolved references. ${vars} ${helpers}`;
  }
  if (vars) {
    return `Prompt template references variables not provided. ${vars}`;
  }
  return `Prompt template references helpers not registered. ${helpers}`;
}

export function missingTemplateReferencesError(
  context: PromptMissingTemplateVariableContext
): LlmExeError<"prompt.missing_template_variable"> {
  return createLlmExeError(
    {
      code: "prompt.missing_template_variable",
      message: buildMessage,
      resolution:
        "Pass every variable referenced by the prompt template, or register any custom helpers used.",
    },
    context
  );
}
