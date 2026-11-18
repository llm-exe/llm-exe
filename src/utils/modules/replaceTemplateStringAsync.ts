import { PromptTemplateOptions } from "@/types";
import { hbsAsync, hbsAsyncNoEscape } from "./handlebars";

export async function replaceTemplateStringAsync(
  templateString?: string,
  substitutions: Record<string, any> = {},
  configuration: PromptTemplateOptions = {
    helpers: [],
    partials: [],
  }
) {
  if (!templateString) return Promise.resolve(templateString || "");
  const instance = configuration?.noEscape ? hbsAsyncNoEscape : hbsAsync;
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
  const res = await (template(substitutions, {
    allowedProtoMethods: {
      substring: true,
    },
  }) as unknown as Promise<string>);

  tempHelpers.forEach(function (n) {
    instance.handlebars.unregisterHelper(n);
  });

  tempPartials.forEach(function (n) {
    instance.handlebars.unregisterPartial(n);
  });

  return res;
}
