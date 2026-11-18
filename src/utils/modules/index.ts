export { assert } from "./assert";
export { defineSchema } from "./defineSchema";
export { LlmExeError, LLM_EXE_ERROR_SYMBOL } from "@/errors/LlmExeError";
export { isLlmExeError } from "@/errors/isLlmExeError";
export { importPartials } from "./handlebars/utils/importPartials";
export { importHelpers } from "./handlebars/utils/importHelpers";
export { filterObjectOnSchema } from "./filterObjectOnSchema";
export { replaceTemplateString } from "./replaceTemplateString";
export { escapeTemplateString } from "./escapeTemplateString";
export { replaceTemplateStringAsync } from "./replaceTemplateStringAsync";
export { asyncCallWithTimeout } from "./asyncCallWithTimeout";
export { guessProviderFromModel } from "./guessProviderFromModel";

export {
  maybeStringifyJSON,
  maybeParseJSON,
  isObjectStringified,
} from "./json";

import { hbs, hbsAsync, hbsAsyncNoEscape, hbsNoEscape } from "./handlebars";

// Global helpers and partials go on every instance, so prompts can use them
// with or without noEscape.
const allInstances = [hbs, hbsAsync, hbsNoEscape, hbsAsyncNoEscape];

export function registerHelpers(helpers: any[]) {
  for (const instance of allInstances) instance.registerHelpers(helpers);
}

export function registerPartials(partials: any[]) {
  for (const instance of allInstances) instance.registerPartials(partials);
}
