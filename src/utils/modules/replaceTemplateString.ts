import { PromptTemplateOptions } from "@/types";
import { hbs } from "@/utils/modules/handlebars";

export function replaceTemplateString(
  templateString?: string,
  substitutions: Record<string, any> = {},
  configuration: PromptTemplateOptions = {
    helpers: [],
    partials: [],
  }
): string {
  if (!templateString) return templateString || "";

  const tempHelpers = [];
  const tempPartials = [];

  if (Array.isArray(configuration.helpers)) {
    hbs.registerHelpers(configuration.helpers);
    tempHelpers.push(...configuration.helpers.map((a) => a.name));
  }

  if (Array.isArray(configuration.partials)) {
    hbs.registerPartials(configuration.partials);
    tempPartials.push(...configuration.partials.map((a) => a.name));
  }

  const template = hbs.handlebars.compile(
    templateString,
    configuration?.noEscape ? { noEscape: true } : undefined
  );
  const res = template(substitutions, {
    allowedProtoMethods: {
      substring: true,
    },
  });

  tempHelpers.forEach(function (n) {
    hbs.handlebars.unregisterHelper(n);
  });

  tempPartials.forEach(function (n) {
    hbs.handlebars.unregisterPartial(n);
  });

  return res;
}

