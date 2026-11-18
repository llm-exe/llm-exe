import Handlebars from "handlebars";
import { isPromise } from "@/utils/modules/isPromise";
import { asyncCoreOverrideHelpers } from "../helpers/async/async-helpers";
import { _registerHelpers } from "./registerHelpers";
import * as contextPartials from "@/utils/modules/handlebars/templates";
import { _registerPartials } from "./registerPartials";
import * as helpers from "@/utils/modules/handlebars/helpers";

export type HandlebarsAsync = typeof Handlebars & {
  compile: (
    ...args: Parameters<typeof Handlebars.compile>
  ) => (context: any, execOptions?: any) => Promise<string>;
};

/** From: https://github.com/gastonrobledo/handlebars-async-helpers/blob/main/index.js */
export function makeHandlebarsInstanceAsync(
  hbs: any,
  { noEscape = false }: { noEscape?: boolean } = {}
) {
  const handlebars: typeof Handlebars = hbs.create();
  const asyncCompiler = class extends hbs.JavaScriptCompiler {
    constructor() {
      super();
      this.compiler = asyncCompiler;
    }

    mergeSource(varDeclarations: any) {
      const sources = super.mergeSource(varDeclarations);
      sources.prepend("return (async () => {");
      sources.add(" })()");
      return sources;
    }

    appendToBuffer(
      source: Record<string, any>,
      location: any,
      explicit: boolean
    ) {
      // Force a source as this simplifies the merge logic.
      if (!Array.isArray(source)) {
        source = [source];
      }
      source = this.source.wrap(source, location);

      if (this.environment.isSimple) {
        return ["return await ", source, ";"];
      }
      /* istanbul ignore next */
      if (explicit) {
        // This is a case where the buffer operation occurs as a child of another
        // construct, generally braces. We have to explicitly output these buffer
        // operations to ensure that the emitted code goes in the correct location.
        return ["buffer += await ", source, ";"];
      }
      source.appendToBuffer = true;
      source.prepend("await ");
      return source;
    }
  };
  (handlebars as any).JavaScriptCompiler = asyncCompiler;

  const _compile = handlebars.compile;
  const _template = (handlebars.VM as any).template;
  const _escapeExpression = handlebars.escapeExpression;

  function escapeExpression(value: any) {
    if (isPromise(value)) {
      return value.then((v: any) => _escapeExpression(v));
    }
    return _escapeExpression(value);
  }

  function lookupProperty(containerLookupProperty: any) {
    return function (parent: any, propertyName: any) {
      if (isPromise(parent)) {
        if (typeof parent?.then === "function") {
          return parent.then((p: any) =>
            containerLookupProperty(p, propertyName)
          );
        }
        return (parent as any)().then((p: any) =>
          containerLookupProperty(p, propertyName)
        );
      }
      return containerLookupProperty(parent, propertyName);
    };
  }

  handlebars.template = function (spec: any) {
    spec.main_d =
      (
        _prog: any,
        _props: any,
        container: any,
        _depth: any,
        data: any,
        blockParams: any,
        depths: any
      ) =>
      async (context: any) => {
        container.escapeExpression = escapeExpression;
        container.lookupProperty = lookupProperty(container.lookupProperty);
        if (depths.length == 0) {
          depths = [data.root];
        }
        const v = spec.main(
          container,
          context,
          container.helpers,
          container.partials,
          data,
          blockParams,
          depths
        );
        return v;
      };
    return _template(spec, handlebars);
  };

  handlebars.compile = function (template: any, options: any) {
    // Partials compiled lazily come through here too, so they get noEscape.
    const compiled = _compile.apply(handlebars, [
      template,
      noEscape ? { ...options, noEscape: true } : { ...options },
    ]);

    return function (context: any, execOptions: any) {
      /* istanbul ignore next */
      context = context || {};
      return compiled.call(handlebars, context, execOptions);
    };
  };

  const helperKeys = Object.keys(helpers) as (keyof typeof helpers)[];
  _registerHelpers(
    helperKeys.map((a) => ({ handler: helpers[a], name: a })),
    handlebars
  );

  const asyncHelperKeys = Object.keys(
    asyncCoreOverrideHelpers
  ) as (keyof typeof asyncCoreOverrideHelpers)[];
  _registerHelpers(
    asyncHelperKeys.map((a) => ({
      handler: asyncCoreOverrideHelpers[a],
      name: a,
    })),
    handlebars
  );

  const contextPartialKeys = Object.keys(
    contextPartials.partials
  ) as (keyof typeof contextPartials.partials)[];
  for (const contextPartialKey of contextPartialKeys) {
    handlebars.registerPartial(
      contextPartialKey,
      contextPartials.partials[contextPartialKey]
    );
  }

  return handlebars as HandlebarsAsync;
}
