import { isEmpty } from "@/utils/modules/isEmpty";
import { LlmExeError } from "@/errors";

interface HandlebarsOptions {
  fn: (context: any) => string;
  inverse: (context: any) => string;
  hash: Record<string, any>;
}

export function ifFn (
  this: Record<string, any>,
  conditional: any,
  options: HandlebarsOptions
) {
  if (arguments.length !== 2) {
    throw new LlmExeError("#if requires exactly one argument", {
      code: "template.invalid_helper_arguments",
      context: {
        operation: "handlebars.helper.if",
        helper: "if",
        expected: 1,
        received: arguments.length,
      },
    });
  }

  else if (typeof conditional === "function") {
    conditional = conditional.call(this);
  }
  // Default behavior is to render the positive path if the value is truthy and not empty.
  // The `includeZero` option may be set to treat the conditional as purely not empty based on the
  // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
  if ((!options.hash.includeZero && !conditional) || isEmpty(conditional)) {
    return options.inverse(this);
  } else {
    return options.fn(this);
  }
}
