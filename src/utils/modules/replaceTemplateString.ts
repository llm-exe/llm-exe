import { PromptTemplateOptions } from "@/types";
import { hbs, hbsNoEscape } from "@/utils/modules/handlebars";

export function replaceTemplateString(
  templateString?: string,
  substitutions: Record<string, any> = {},
  configuration: PromptTemplateOptions = {
    helpers: [],
    partials: [],
  }
): string {
  if (!templateString) return templateString || "";

  const instance = configuration?.noEscape ? hbsNoEscape : hbs;
  const tempHelpers = [];
  const tempPartials = [];

  if (Array.isArray(configuration.helpers)) {
    instance.registerHelpers(configuration.helpers);
    tempHelpers.push(...configuration.helpers.map((a) => a.name));
  }

  if (Array.isArray(configuration.partials)) {
    instance.registerPartials(configuration.partials);
    tempPartials.push(...configuration.partials.map((a) => a.name));
  }

  const template = instance.handlebars.compile(templateString);
  const res = template(substitutions, {
    allowedProtoMethods: {
      substring: true,
    },
  });

  tempHelpers.forEach(function (n) {
    instance.handlebars.unregisterHelper(n);
  });

  tempPartials.forEach(function (n) {
    instance.handlebars.unregisterPartial(n);
  });

  return res;
}
