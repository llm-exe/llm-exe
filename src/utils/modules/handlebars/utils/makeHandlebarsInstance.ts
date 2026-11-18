import Handlebars from "handlebars";
import { _registerPartials } from "@/utils/modules/handlebars/utils/registerPartials";
import { _registerHelpers } from "@/utils/modules/handlebars/utils/registerHelpers";

import * as contextPartials from "@/utils/modules/handlebars/templates";
import * as helpers from "@/utils/modules/handlebars/helpers";

export function makeHandlebarsInstance(
  hbs: typeof Handlebars,
  { noEscape = false }: { noEscape?: boolean } = {}
) {
  const handlebars = hbs.create();

  if (noEscape) {
    // Set on the instance, not per call, so the partials Handlebars compiles
    // lazily and the hbsInTemplate helper below get it too.
    const compile = handlebars.compile;
    handlebars.compile = (input, options) =>
      compile.call(handlebars, input, { ...options, noEscape: true });
  }

  const helperKeys = Object.keys(helpers) as (keyof typeof helpers)[];
  _registerHelpers(
    helperKeys.map((a) => ({ handler: helpers[a], name: a })),
    handlebars
  );

  handlebars.registerHelper(
    "hbsInTemplate",
    function (str: string, substitutions: Record<string, any>) {
      const template = handlebars.compile(str);
      return template(substitutions, {
        allowedProtoMethods: {
          substring: true,
        },
      });
    }
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

  return handlebars;
}
