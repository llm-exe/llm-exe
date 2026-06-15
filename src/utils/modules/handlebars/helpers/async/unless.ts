import { ifFnAsync } from "@/utils/modules/handlebars/helpers/async/if";
import { LlmExeError } from "@/errors";

interface HandlebarsOptions {
  fn: (context: any) => string;
  inverse: (context: any) => string;
  hash: Record<string, any>;
}

export async function unlessFnAsync(
  this: Record<string, any>,
  conditional: any,
  options: HandlebarsOptions
) {
  if (arguments.length !== 2) {
    throw new LlmExeError("#unless requires exactly one argument", {
      code: "template.invalid_helper_arguments",
      context: {
        operation: "handlebars.asyncHelper.unless",
        helper: "unless",
        expected: 1,
        received: arguments.length,
      },
    });
  }
  
  return ifFnAsync.call(this, conditional, {
    fn: options.inverse,
    inverse: options.fn,
    hash: options.hash,
  });
}