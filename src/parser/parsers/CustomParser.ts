import { ExecutionContext } from "@/interfaces";
import { BaseParser } from "../_base";

/**
 * CustomParser class, extending the BaseParser class.
 * @template O The type of the parsed value (output)
 * @extends {BaseParser<O>}
 *
 * v3 parser contract:
 * Category: pass-through extension point
 * Mode: user-defined
 *
 * Calls the user parser function with text and the per-call ExecutionContext.
 * Returns the user parser result exactly.
 * Does not wrap user parser errors.
 *
 * When invoked through an executor, `context` includes the resolved trace ID,
 * stable executor metadata, current execution metadata, and the attributes
 * extension bag. When parse() is called directly without a context, callers
 * may pass any shape they want; the type widens to allow that.
 */
export class CustomParser<O = any> extends BaseParser<O> {
  public parserFn: (text: string, context: ExecutionContext<any, O>) => O;

  constructor(
    name: string,
    parserFn: (text: string, context: ExecutionContext<any, O>) => O
  ) {
    super(name);
    this.parserFn = parserFn;
  }

  parse(text: string, context?: ExecutionContext<any, O>): O {
    return this.parserFn.call(this, text, context as ExecutionContext<any, O>);
  }
}
