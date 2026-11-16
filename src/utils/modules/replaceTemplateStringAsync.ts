import { PromptTemplateOptions } from "@/types";
import { hbsAsync } from "./handlebars";

export async function replaceTemplateStringAsync(
  templateString?: string,
  substitutions: Record<string, any> = {},
  configuration: PromptTemplateOptions = {
    helpers: [],
    partials: [],
  }
) {
  if (!templateString) return Promise.resolve(templateString || "");
  const tempHelpers = [];
  const tempPartials = [];

  if (Array.isArray(configuration.helpers)) {
    hbsAsync.registerHelpers(configuration.helpers);
    tempHelpers.push(...configuration.helpers.map((a) => a.name));
  }

  if (Array.isArray(configuration.partials)) {
    hbsAsync.registerPartials(configuration.partials);
    tempPartials.push(...configuration.partials.map((a) => a.name));
  }

  const template = hbsAsync.handlebars.compile(
    templateString,
    configuration?.noEscape ? { noEscape: true } : undefined
  );
  const res = await (template(substitutions, {
    allowedProtoMethods: {
      substring: true,
    },
  }) as unknown as Promise<string>);

  tempHelpers.forEach(function (n) {
    hbsAsync.handlebars.unregisterHelper(n);
  });

  tempPartials.forEach(function (n) {
    hbsAsync.handlebars.unregisterPartial(n);
  });

  return res;
}
