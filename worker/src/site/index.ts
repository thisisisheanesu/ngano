/**
 * The ngano site: ten server-rendered pages and the fixed-path assets they need.
 *
 * Every renderer is a pure function of the `SiteContext` the Worker builds once per
 * isolate. Nothing here reads the network, touches global state or mutates the context,
 * so a page can be rendered, cached and discarded freely.
 *
 * The three lookup renderers return `null` for an unknown id, so the router can answer
 * with `renderNotFound` and a 404 status rather than a page that pretends to exist.
 *
 *     renderHome(ctx)                 -> string
 *     renderMap(ctx)                  -> string
 *     renderCountries(ctx)            -> string
 *     renderLanguages(ctx)            -> string
 *     renderCountry(ctx, iso2)        -> string | null
 *     renderDataset(ctx, id)          -> string | null
 *     renderLanguage(ctx, tag)        -> string | null
 *     renderCredits(ctx)              -> string
 *     renderDocs(ctx)                 -> string
 *     renderNotFound(ctx, path)       -> string
 *     siteAssets                      -> Record<string, {body, contentType}>
 *
 * `renderCountry` accepts an ISO 3166 alpha-2 code in any case. `renderLanguage`
 * accepts a BCP 47 language tag in any case, a bare ISO 639-3 code, or any spelling a
 * source used, and answers with the page for the tag that key resolves to; percent
 * encoding is tolerated. `renderDataset` accepts an ngano id, percent encoded or not.
 */

export { renderHome } from './home';
export { renderMap } from './mapPage';
export { renderCountries } from './countriesPage';
export { renderLanguages } from './languagesPage';
export { renderCountry } from './country';
export { renderDataset } from './dataset';
export { renderLanguage } from './language';
export { renderCredits } from './credits';
export { renderDocs } from './docs';
export { renderNotFound } from './notfound';
export { siteAssets } from './assets';
