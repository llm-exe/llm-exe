import { ifFn } from "./if";
import { LlmExeError } from "@/errors";

export function unless(this: any, conditional: any, options: any) {
    if (arguments.length !== 2) {
      throw new LlmExeError("#unless requires exactly one argument", {
        code: "template.invalid_helper_arguments",
        context: {
          operation: "handlebars.helper.unless",
          helper: "unless",
          expected: 1,
          received: arguments.length,
        },
      });
    }
    
    return ifFn.call(this, conditional, {
      fn: options.inverse,
      inverse: options.fn,
      hash: options.hash,
    });
  }