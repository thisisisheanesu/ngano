//! Catalogue record types: datasets, countries, languages and aggregates.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// One catalogue record: a published dataset, as described by its source.
///
/// Figures are reported as the source publishes them. [`Dataset::unverified_size`]
/// marks self-reported totals of 20,000 hours or more, which are excluded from
/// every hours aggregate in this crate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Dataset {
    /// Stable ngano identifier, for example `waxal-corpus-paper`.
    pub id: String,
    /// Human readable dataset name.
    pub name: String,
    /// `ASR`, `TTS`, `ASR+TTS`, `Raw source` or `Other`.
    pub task: String,
    /// Language variety grouping, for example `Indigenous`.
    pub variety: String,
    /// Languages exactly as the source lists them.
    #[serde(default)]
    pub languages: Vec<String>,
    /// Languages after normalisation against `data/languages.json`, in the
    /// same order as [`Dataset::language_tags`].
    #[serde(default)]
    pub languages_clean: Vec<String>,
    /// ISO 639-3 codes as the record was first catalogued. Prefer
    /// [`Dataset::language_codes`], which is derived from the tags.
    #[serde(default)]
    pub iso: Vec<String>,
    /// Canonical BCP 47 language tags, ordered, one per language the record
    /// covers. The primary subtag is an ISO 639-3 code and a region subtag
    /// marks a country-specific variety, so `eng-NG` is Nigerian English.
    #[serde(default)]
    pub language_tags: Vec<String>,
    /// The bare ISO 639-3 codes behind [`Dataset::language_tags`],
    /// deduplicated, so every regional variety collapses into its code.
    #[serde(default)]
    pub language_codes: Vec<String>,
    /// An editorial note about how this record names its languages, present on
    /// the handful of sources that describe their coverage in prose rather than
    /// naming languages one by one.
    #[serde(default)]
    pub language_note: Option<String>,
    /// Country names as the source lists them.
    #[serde(default)]
    pub countries: Vec<String>,
    /// ISO 3166-1 alpha-2 codes for [`Dataset::countries`].
    #[serde(default)]
    pub country_codes: Vec<String>,
    /// Regional groupings, for example `East Africa`.
    #[serde(default)]
    pub regions: Vec<String>,
    /// Hours as published, verbatim, including any qualifying text.
    #[serde(default)]
    pub hours: Option<String>,
    /// Numeric hours parsed from [`Dataset::hours`], when one could be parsed.
    #[serde(default)]
    pub hours_num: Option<f64>,
    /// Speaker count as published.
    #[serde(default)]
    pub speakers: Option<String>,
    /// Recording setup, for example `telephone` or `studio`.
    #[serde(default)]
    pub recording_type: Option<String>,
    /// Audio quality band, for example `Standard (16 kHz)`.
    pub quality: String,
    /// `Transcribed`, `Unlabelled` or `Unstated`.
    pub labelled: String,
    /// Recording domain, for example `Broadcast news`.
    pub domain: String,
    /// Licence string as published.
    pub licence: String,
    /// Licence family, for example `Attribution (CC-BY)`.
    pub licence_class: String,
    /// `Yes`, `Yes, if purchased`, `No` or `Unstated`.
    pub commercial: String,
    /// `Open`, `Request`, `Paid`, `Scrape required` or `Unclear`.
    pub access: String,
    /// Where the data lives, for example `HuggingFace`.
    pub host: String,
    /// Canonical URL for the dataset.
    #[serde(default)]
    pub url: Option<String>,
    /// Hugging Face repo id, when the dataset is hosted there.
    #[serde(default)]
    pub hf_repo: Option<String>,
    /// Publication year as published.
    #[serde(default)]
    pub year: Option<String>,
    /// Editorial notes about scope, caveats and provenance.
    #[serde(default)]
    pub notes: String,
    /// True when the published size is self-reported and 20,000 hours or more.
    /// Such figures are excluded from every total.
    #[serde(default)]
    pub unverified_size: bool,
}

impl Dataset {
    /// Hours that may be counted in a total: `None` when the figure is missing
    /// or flagged [`Dataset::unverified_size`].
    ///
    /// ```
    /// use ngano::Catalogue;
    ///
    /// let cat = Catalogue::bundled()?;
    /// let counted: f64 = cat.all().iter().filter_map(|d| d.countable_hours()).sum();
    /// assert!(counted > 0.0);
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn countable_hours(&self) -> Option<f64> {
        if self.unverified_size {
            None
        } else {
            self.hours_num
        }
    }

    /// True when the dataset can be streamed, meaning it has a Hugging Face repo.
    pub fn is_streamable(&self) -> bool {
        self.hf_repo.as_deref().is_some_and(|r| !r.is_empty())
    }

    /// True when the licence permits commercial use outright or after purchase.
    pub fn allows_commercial_use(&self) -> bool {
        let c = self.commercial.to_ascii_lowercase();
        c.starts_with("yes")
    }
}

/// A country in the catalogue's coverage map.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Country {
    /// Canonical country name.
    pub name: String,
    /// ISO 3166-1 alpha-2 code.
    pub iso2: String,
    /// ISO 3166-1 alpha-3 code.
    pub iso3: String,
    /// Name used by the bundled GeoJSON polygons. `None` for island states,
    /// which have no polygon and are drawn from `lat` and `lon` instead.
    #[serde(default)]
    pub map_name: Option<String>,
    /// Centroid latitude.
    pub lat: f64,
    /// Centroid longitude.
    pub lon: f64,
    /// Regional grouping, for example `Southern Africa`.
    pub region: String,
    /// URL slug, normally the lowercased alpha-2 code.
    pub slug: String,
    /// Dataset count, when the record came from the HTTP API.
    #[serde(default)]
    pub datasets: Option<u32>,
    /// Counted hours, when the record came from the HTTP API.
    #[serde(default)]
    pub hours: Option<f64>,
}

/// A language in the catalogue's coverage map, keyed on its BCP 47 tag.
///
/// The registry entry behind the tag is [`LanguageCode`](crate::LanguageCode);
/// this record adds what the catalogue knows about the language's coverage.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Language {
    /// Canonical BCP 47 tag, for example `sna` or `eng-NG`.
    pub tag: String,
    /// The bare ISO 639-3 code behind the tag.
    pub iso639_3: String,
    /// ISO 3166-1 alpha-2 region subtag, when the tag names a country-specific
    /// variety.
    #[serde(default)]
    pub region: Option<String>,
    /// Canonical language name.
    pub name: String,
    /// ISO 639-3 scope: `I` individual, `M` macrolanguage, `S` special.
    #[serde(default)]
    pub scope: Option<String>,
    /// ISO 639-3 type: `L` living, `E` extinct, and so on. Named `kind`
    /// because `type` is a Rust keyword.
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    /// Every catalogue spelling that resolves to this tag.
    #[serde(default)]
    pub aliases: Vec<String>,
    /// URL slug, which is the tag lowercased.
    pub slug: String,
    /// Number of datasets covering it.
    #[serde(default)]
    pub datasets: Option<u32>,
    /// Counted hours across its datasets.
    #[serde(default)]
    pub hours: Option<f64>,
    /// Countries where the catalogue records it, by name.
    #[serde(default)]
    pub countries: Vec<String>,
    /// ISO 3166-1 alpha-2 codes for [`Language::countries`].
    #[serde(default)]
    pub country_codes: Vec<String>,
    /// Tasks covered by its datasets, for example `ASR`.
    #[serde(default)]
    pub tasks: Vec<String>,
}

/// Aggregates computed over a [`Catalogue`](crate::Catalogue).
///
/// Hours never include datasets flagged [`Dataset::unverified_size`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Stats {
    /// Number of dataset records.
    pub datasets: usize,
    /// Sum of countable hours.
    pub hours: f64,
    /// Number of records with a self-reported, unverified size.
    pub unverified_datasets: usize,
    /// Number of records with a Hugging Face repo.
    pub streamable_datasets: usize,
    /// Distinct language tags named across the catalogue.
    pub languages: usize,
    /// Distinct ISO 639-3 codes, so every regional variety collapses into its
    /// code.
    pub language_codes: usize,
    /// Distinct countries named across the catalogue.
    pub countries: usize,
    /// Record counts by task.
    pub by_task: BTreeMap<String, usize>,
    /// Record counts by access mode.
    pub by_access: BTreeMap<String, usize>,
    /// Record counts by licence family.
    pub by_licence_class: BTreeMap<String, usize>,
    /// Record counts by commercial-use flag.
    pub by_commercial: BTreeMap<String, usize>,
    /// Record counts by region.
    pub by_region: BTreeMap<String, usize>,
    /// Countable hours by region.
    pub hours_by_region: BTreeMap<String, f64>,
}
