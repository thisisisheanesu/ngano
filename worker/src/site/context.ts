/**
 * The site's view of the Worker context.
 *
 * This module existed to widen `SiteContext` with `snippets` while the Worker core was
 * still adding the field, and again while the language types were re-keyed on ISO 639-3.
 * Both have landed, so it is now a plain re-export and there is a single definition of
 * every shared type in `../types`. Page renderers keep importing from here, which costs
 * nothing and leaves one place to adjust if the site ever needs a view of the context
 * the Worker core does not carry.
 */

export type {
  Country,
  CountryStats,
  Credits,
  CreditLink,
  Dataset,
  FacetCount,
  Language,
  LanguageCode,
  LanguageCodes,
  SiteContext,
  SnippetKey,
  SnippetPack,
  SnippetSet,
  Stats,
} from '../types';

/** The seven tokens `data/snippets.json` leaves for the site to fill in. */
export type SnippetToken =
  | 'CONFIG'
  | 'COUNTRY_ISO2'
  | 'COUNTRY_NAME'
  | 'DATASET_ID'
  | 'HF_REPO'
  | 'LANGUAGE'
  | 'TASK';
