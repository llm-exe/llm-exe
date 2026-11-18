import type Handlebars from "handlebars";
import { _hbs, _hbsAsync, _hbsAsyncNoEscape, _hbsNoEscape } from "./hbs";
import { _registerHelpers } from "./utils/registerHelpers";
import { _registerPartials } from "./utils/registerPartials";

function withRegistration<H extends typeof Handlebars>(handlebars: H) {
  return {
    handlebars,
    registerHelpers: (helpers: any[]) => {
      _registerHelpers(helpers, handlebars);
    },
    registerPartials: (partials: any[]) => {
      _registerPartials(partials, handlebars);
    },
  };
}

export const hbs = withRegistration(_hbs);
export const hbsAsync = withRegistration(_hbsAsync);

/** Every template compiled on these skips HTML escaping. See hbs.ts. */
export const hbsNoEscape = withRegistration(_hbsNoEscape);
export const hbsAsyncNoEscape = withRegistration(_hbsAsyncNoEscape);
