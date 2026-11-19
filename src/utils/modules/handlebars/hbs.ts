import Handlebars from "handlebars";
import { makeHandlebarsInstance } from "@/utils/modules/handlebars/utils/makeHandlebarsInstance";
import { makeHandlebarsInstanceAsync } from "@/utils/modules/handlebars/utils/makeHandlebarsInstanceAsync";

export const _hbsAsync = makeHandlebarsInstanceAsync(Handlebars);
export const _hbs = makeHandlebarsInstance(Handlebars);

// Prompts with `noEscape: true` render on their own instances. Handlebars
// compiles a string partial the first time a template uses it, with that
// template's options, and caches the result on the instance. With one shared
// instance, whichever mode rendered a partial first would decide it for both.
export const _hbsAsyncNoEscape = makeHandlebarsInstanceAsync(Handlebars, {
  noEscape: true,
});
export const _hbsNoEscape = makeHandlebarsInstance(Handlebars, {
  noEscape: true,
});
