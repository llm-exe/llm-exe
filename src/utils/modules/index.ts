export { assert } from "./assert";
export { defineSchema } from "./defineSchema";
export { LlmExeError, LLM_EXE_ERROR_SYMBOL } from "@/errors/LlmExeError";
export { isLlmExeError } from "@/errors/isLlmExeError";
export { importPartials } from "./handlebars/utils/importPartials";
export { importHelpers } from "./handlebars/utils/importHelpers";
export { filterObjectOnSchema } from "./filterObjectOnSchema";
export { replaceTemplateString } from "./replaceTemplateString";
export { replaceTemplateStringAsync } from "./replaceTemplateStringAsync";
export { asyncCallWithTimeout } from "./asyncCallWithTimeout";
export { guessProviderFromModel } from "./guessProviderFromModel";

export {
  maybeStringifyJSON,
  maybeParseJSON,
  isObjectStringified,
} from "./json";

import { hbs, hbsAsync } from "./handlebars";

export function registerHelpers(helpers: any[]) {
  hbs.registerHelpers(helpers);
  hbsAsync.registerHelpers(helpers);
}

export function registerPartials(partials: any[]) {
  hbs.registerPartials(partials);
  hbsAsync.registerPartials(partials);
}
