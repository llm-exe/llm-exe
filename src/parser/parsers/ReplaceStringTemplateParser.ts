import { replaceTemplateString } from "@/utils/modules/replaceTemplateString";
import { BaseParser } from "../_base";
import { LlmExeError } from "@/errors";

/**
 * v3 parser contract:
 * Category: pass-through transformation
 * Mode: template replacement
 *
 * Accepts a string template and optional attributes object.
 * Returns the helper replacement result.
 * Throws LlmExeError(parser.parse_failed) for invalid input type,
 * invalid attributes, or template helper failures.
 *
 */
export class ReplaceStringTemplateParser extends BaseParser<string> {
  constructor() {
    super("replaceStringTemplate");
  }
  parse(text: string, attributes?: Record<string, any>) {
    if (typeof text !== "string") {
      throw new LlmExeError(
        `Invalid input. Expected string. Received ${text === null ? "null" : Array.isArray(text) ? "array" : typeof text}.`,
        {
          code: "parser.invalid_input",
          context: {
            operation: "ReplaceStringTemplateParser.parse",
            parser: "replaceStringTemplate",
            reason: "invalid_input_type",
            expected: "string",
            received: text === null ? "null" : Array.isArray(text) ? "array" : typeof text,
          },
        }
      );
    }

    if (
      attributes !== undefined &&
      (attributes === null ||
        typeof attributes !== "object" ||
        Array.isArray(attributes))
    ) {
      throw new LlmExeError(`Invalid attributes. Expected object.`, {
        code: "parser.invalid_input",
        context: {
          operation: "ReplaceStringTemplateParser.parse",
          parser: "replaceStringTemplate",
          reason: "invalid_attributes",
          expected: "object",
          received: attributes === null ? "null" : Array.isArray(attributes) ? "array" : typeof attributes,
        },
      });
    }

    try {
      return replaceTemplateString(text, attributes);
    } catch (cause) {
      let received: string = typeof cause;
      /* istanbul ignore else -- Handlebars/template failures throw Error instances; non-Error throwables are defensive. */
      if (cause instanceof Error) {
        received = cause.name;
      }
      throw new LlmExeError(`Template replacement failed.`, {
        code: "parser.parse_failed",
        context: {
          operation: "ReplaceStringTemplateParser.parse",
          parser: "replaceStringTemplate",
          reason: "template_replacement_failed",
          inputLength: text.length,
          received,
        },
        cause,
      });
    }
  }
}
