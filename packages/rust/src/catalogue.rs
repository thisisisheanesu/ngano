//! The dataset catalogue: bundled offline snapshot, or live from the HTTP API.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Arc;

use serde::Deserialize;

use crate::error::{NganoError, Result};
use crate::filter::Filter;
use crate::http::HttpClient;
use crate::language::{LanguageCode, LanguageRegistry};
use crate::model::{Country, Dataset, Language, Stats};

/// The public ngano API base URL.
pub const DEFAULT_API_BASE: &str = "https://ngano.dev/api/v1";

/// The catalogue snapshot compiled into this crate.
const BUNDLED_CATALOGUE: &str = include_str!(concat!(env!("OUT_DIR"), "/catalogue.json"));
/// The country list compiled into this crate.
const BUNDLED_COUNTRIES: &str = include_str!(concat!(env!("OUT_DIR"), "/countries.json"));
/// The language list compiled into this crate.
const BUNDLED_LANGUAGES: &str = include_str!(concat!(env!("OUT_DIR"), "/languages.json"));

/// Envelope returned by `GET /datasets`.
#[derive(Debug, Deserialize)]
struct Page {
    data: Vec<Dataset>,
    #[serde(default)]
    meta: PageMeta,
}

/// Pagination block of a `GET /datasets` response.
#[derive(Debug, Default, Deserialize)]
struct PageMeta {
    #[serde(default)]
    total_pages: Option<u32>,
}

/// An in-memory catalogue of datasets, countries and languages.
///
/// Cloning is cheap: the records sit behind an [`Arc`].
///
/// ```
/// use ngano::{Catalogue, Filter};
///
/// let cat = Catalogue::bundled()?;
/// assert!(cat.len() > 100);
/// let shona = cat.datasets(&Filter::new().language("sna"));
/// assert!(!shona.is_empty());
/// # Ok::<(), ngano::NganoError>(())
/// ```
#[derive(Debug, Clone)]
pub struct Catalogue {
    inner: Arc<Inner>,
}

/// The owned contents of a catalogue.
#[derive(Debug)]
pub(crate) struct Inner {
    datasets: Vec<Dataset>,
    countries: Vec<Country>,
    languages: Vec<Language>,
    by_id: HashMap<String, usize>,
    by_repo: HashMap<String, usize>,
    country_by_name: HashMap<String, String>,
    language_by_tag: HashMap<String, usize>,
}

impl Catalogue {
    /// Load the snapshot compiled into the binary. Never touches the network.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// assert!(!cat.countries().is_empty());
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn bundled() -> Result<Self> {
        let datasets: Vec<Dataset> = serde_json::from_str(BUNDLED_CATALOGUE)?;
        let countries: Vec<Country> = serde_json::from_str(BUNDLED_COUNTRIES)?;
        let languages: Vec<Language> = serde_json::from_str(BUNDLED_LANGUAGES)?;
        Ok(Self::from_parts(datasets, countries, languages))
    }

    /// Build a catalogue from records you already hold.
    pub fn from_parts(
        datasets: Vec<Dataset>,
        countries: Vec<Country>,
        languages: Vec<Language>,
    ) -> Self {
        let by_id = datasets
            .iter()
            .enumerate()
            .map(|(i, d)| (d.id.to_lowercase(), i))
            .collect();
        let by_repo = datasets
            .iter()
            .enumerate()
            .filter_map(|(i, d)| Some((d.hf_repo.as_ref()?.to_lowercase(), i)))
            .collect();
        let mut country_by_name = HashMap::with_capacity(countries.len() * 3);
        for c in &countries {
            country_by_name.insert(c.name.to_lowercase(), c.iso2.clone());
            if let Some(map_name) = &c.map_name {
                country_by_name.insert(map_name.to_lowercase(), c.iso2.clone());
            }
            country_by_name.insert(c.iso3.to_lowercase(), c.iso2.clone());
        }
        let language_by_tag = languages
            .iter()
            .enumerate()
            .map(|(i, l)| (l.tag.to_lowercase(), i))
            .collect();
        Self {
            inner: Arc::new(Inner {
                datasets,
                countries,
                languages,
                by_id,
                by_repo,
                country_by_name,
                language_by_tag,
            }),
        }
    }

    /// Fetch the live catalogue from `https://ngano.dev/api/v1`.
    ///
    /// ```no_run
    /// # async fn run() -> Result<(), ngano::NganoError> {
    /// let cat = ngano::Catalogue::from_api().await?;
    /// println!("{} datasets", cat.len());
    /// # Ok(()) }
    /// ```
    pub async fn from_api() -> Result<Self> {
        Self::from_api_base(DEFAULT_API_BASE).await
    }

    /// Fetch the live catalogue from a specific API base URL, for a mirror or a
    /// local development server.
    pub async fn from_api_base(base: &str) -> Result<Self> {
        let base = base.trim_end_matches('/');
        let http = HttpClient::new("ngano api")?;

        let mut datasets = Vec::new();
        let mut page = 1u32;
        loop {
            let url = format!("{base}/datasets?page={page}&per_page=200");
            let body: Page = http.get_json(&url, None).await?;
            let empty = body.data.is_empty();
            datasets.extend(body.data);
            let total_pages = body.meta.total_pages.unwrap_or(page);
            if empty || page >= total_pages {
                break;
            }
            page += 1;
        }

        let countries: Vec<Country> = http.get_json(&format!("{base}/countries"), None).await?;
        let languages: Vec<Language> = http.get_json(&format!("{base}/languages"), None).await?;
        Ok(Self::from_parts(datasets, countries, languages))
    }

    /// Blocking counterpart of [`Catalogue::from_api`].
    ///
    /// Available with the `blocking` feature. It starts a private current-thread
    /// runtime, so it must not be called from inside an async runtime.
    #[cfg(feature = "blocking")]
    #[cfg_attr(docsrs, doc(cfg(feature = "blocking")))]
    pub fn from_api_blocking() -> Result<Self> {
        crate::blocking::block_on(Self::from_api())
    }

    /// Blocking counterpart of [`Catalogue::from_api_base`].
    #[cfg(feature = "blocking")]
    #[cfg_attr(docsrs, doc(cfg(feature = "blocking")))]
    pub fn from_api_base_blocking(base: &str) -> Result<Self> {
        crate::blocking::block_on(Self::from_api_base(base))
    }

    /// Every dataset record, in catalogue order.
    pub fn all(&self) -> &[Dataset] {
        &self.inner.datasets
    }

    /// Number of dataset records.
    pub fn len(&self) -> usize {
        self.inner.datasets.len()
    }

    /// True when the catalogue holds no dataset records.
    pub fn is_empty(&self) -> bool {
        self.inner.datasets.is_empty()
    }

    /// Every country in the coverage map.
    pub fn countries(&self) -> &[Country] {
        &self.inner.countries
    }

    /// Every language in the coverage map, one per BCP 47 tag.
    pub fn languages(&self) -> &[Language] {
        &self.inner.languages
    }

    /// The ISO 639-3 registry compiled into this crate: every canonical tag,
    /// with its bare code, its name and every catalogue spelling of it.
    ///
    /// This is the registry itself, so it lists tags the catalogue may not have
    /// a dataset for, whereas [`Catalogue::languages`] lists coverage.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// let sna = cat
    ///     .language_codes()
    ///     .iter()
    ///     .find(|c| c.tag == "sna")
    ///     .expect("Shona is in the registry");
    /// assert_eq!(sna.name, "Shona");
    /// assert_eq!(sna.iso639_3, "sna");
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn language_codes(&self) -> &[LanguageCode] {
        self.registry().codes()
    }

    /// The language registry behind [`Catalogue::language_codes`].
    pub fn registry(&self) -> &'static LanguageRegistry {
        LanguageRegistry::shared()
    }

    /// Resolve a code, a tag or a name to canonical BCP 47 tags.
    ///
    /// The rules are [`LanguageRegistry::resolve`], without widening: a tag
    /// first, then a bare code that exists only as regional varieties, then a
    /// name from the registry aliases. Anything unrecognised gives an empty
    /// vector rather than a guess.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// assert_eq!(cat.resolve_language("isiZulu"), vec!["zul".to_string()]);
    /// assert_eq!(cat.resolve_language("ENG-ng"), vec!["eng-NG".to_string()]);
    /// assert!(cat.resolve_language("Klingon").is_empty());
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn resolve_language(&self, value: &str) -> Vec<String> {
        self.registry().resolve(value, false)
    }

    /// The coverage record for any accepted spelling of a language: a tag, a
    /// bare code or a name. Never widens a bare code to its varieties.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// assert_eq!(cat.language("Shona").map(|l| l.tag.as_str()), Some("sna"));
    /// assert!(cat.language("nothing-at-all").is_none());
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn language(&self, value: &str) -> Option<&Language> {
        self.resolve_language(value).into_iter().find_map(|tag| {
            self.inner
                .language_by_tag
                .get(&tag.to_lowercase())
                .map(|i| &self.inner.languages[*i])
        })
    }

    /// Datasets matching a filter, in catalogue order.
    ///
    /// ```
    /// use ngano::{Catalogue, Filter};
    ///
    /// let cat = Catalogue::bundled()?;
    /// let hits = cat.datasets(&Filter::new().country("ZW").hf_only(true));
    /// assert!(hits.iter().all(|d| d.is_streamable()));
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn datasets(&self, filter: &Filter) -> Vec<&Dataset> {
        self.inner
            .datasets
            .iter()
            .filter(|d| filter.matches(d))
            .collect()
    }

    /// One dataset by its catalogue id, case-insensitively.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// let first = cat.all().first().unwrap().id.clone();
    /// assert!(cat.get(&first).is_some());
    /// assert!(cat.get("no-such-dataset").is_none());
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn get(&self, id: &str) -> Option<&Dataset> {
        self.inner
            .by_id
            .get(&id.to_lowercase())
            .map(|i| &self.inner.datasets[*i])
    }

    /// One dataset by its Hugging Face repo id, case-insensitively.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// let repo = cat
    ///     .all()
    ///     .iter()
    ///     .find_map(|d| d.hf_repo.clone())
    ///     .expect("the catalogue lists hugging face repos");
    /// assert!(cat.by_hf_repo(&repo).is_some());
    /// assert!(cat.by_hf_repo("nobody/nothing").is_none());
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn by_hf_repo(&self, repo: &str) -> Option<&Dataset> {
        self.inner
            .by_repo
            .get(&repo.trim().to_lowercase())
            .map(|i| &self.inner.datasets[*i])
    }

    /// One dataset by id, as an error when it is missing.
    pub fn require(&self, id: &str) -> Result<&Dataset> {
        self.get(id)
            .ok_or_else(|| NganoError::NotFound(format!("dataset {id}")))
    }

    /// Free-text search over names, ids, languages, countries and notes.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// let hits = cat.search("parliament");
    /// assert!(hits.iter().all(|d| !d.id.is_empty()));
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn search(&self, query: &str) -> Vec<&Dataset> {
        self.datasets(&Filter::new().q(query))
    }

    /// Aggregates over the whole catalogue. Hours exclude unverified figures.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// let s = cat.stats();
    /// assert_eq!(s.datasets, cat.len());
    /// assert!(s.hours > 0.0);
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn stats(&self) -> Stats {
        self.stats_for(self.all())
    }

    /// Aggregates over an arbitrary selection, such as the result of
    /// [`Catalogue::datasets`].
    pub fn stats_for<'a, I>(&self, datasets: I) -> Stats
    where
        I: IntoIterator<Item = &'a Dataset>,
    {
        let mut s = Stats {
            datasets: 0,
            hours: 0.0,
            unverified_datasets: 0,
            streamable_datasets: 0,
            languages: 0,
            language_codes: 0,
            countries: 0,
            by_task: BTreeMap::new(),
            by_access: BTreeMap::new(),
            by_licence_class: BTreeMap::new(),
            by_commercial: BTreeMap::new(),
            by_region: BTreeMap::new(),
            hours_by_region: BTreeMap::new(),
        };
        let mut languages = BTreeSet::new();
        let mut language_codes = BTreeSet::new();
        let mut countries = BTreeSet::new();

        for d in datasets {
            s.datasets += 1;
            if d.unverified_size {
                s.unverified_datasets += 1;
            }
            if d.is_streamable() {
                s.streamable_datasets += 1;
            }
            let hours = d.countable_hours().unwrap_or(0.0);
            s.hours += hours;
            for tag in &d.language_tags {
                languages.insert(tag.clone());
            }
            for code in &d.language_codes {
                language_codes.insert(code.clone());
            }
            for c in &d.country_codes {
                countries.insert(c.clone());
            }
            *s.by_task.entry(d.task.clone()).or_default() += 1;
            *s.by_access.entry(d.access.clone()).or_default() += 1;
            *s.by_licence_class
                .entry(d.licence_class.clone())
                .or_default() += 1;
            *s.by_commercial.entry(d.commercial.clone()).or_default() += 1;
            for r in &d.regions {
                *s.by_region.entry(r.clone()).or_default() += 1;
                *s.hours_by_region.entry(r.clone()).or_default() += hours;
            }
        }
        s.languages = languages.len();
        s.language_codes = language_codes.len();
        s.countries = countries.len();
        s
    }

    /// Resolve a country name or code to an ISO 3166-1 alpha-2 code.
    ///
    /// ```
    /// let cat = ngano::Catalogue::bundled()?;
    /// assert_eq!(cat.country_code("Zimbabwe").as_deref(), Some("ZW"));
    /// assert_eq!(cat.country_code("zw").as_deref(), Some("ZW"));
    /// assert_eq!(cat.country_code("Atlantis"), None);
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn country_code(&self, value: &str) -> Option<String> {
        let trimmed = value.trim();
        if trimmed.len() == 2 {
            let upper = trimmed.to_uppercase();
            if self.inner.countries.iter().any(|c| c.iso2 == upper) {
                return Some(upper);
            }
        }
        self.inner
            .country_by_name
            .get(&trimmed.to_lowercase())
            .cloned()
    }

    /// Internal handle on the name-to-code table, shared with row mapping.
    pub(crate) fn country_index(&self) -> Arc<Inner> {
        Arc::clone(&self.inner)
    }
}

impl Inner {
    /// Resolve a country label seen in a data row to an alpha-2 code.
    pub(crate) fn resolve_country(&self, value: &str) -> Option<String> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return None;
        }
        if trimmed.len() == 2 {
            let upper = trimmed.to_uppercase();
            if self.countries.iter().any(|c| c.iso2 == upper) {
                return Some(upper);
            }
        }
        self.country_by_name.get(&trimmed.to_lowercase()).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_catalogue_parses() {
        let cat = Catalogue::bundled().expect("bundled catalogue parses");
        assert!(
            cat.len() >= 600,
            "expected the full catalogue, got {}",
            cat.len()
        );
        assert_eq!(cat.countries().len(), 58);
        assert!(cat.languages().len() >= 300);
        assert!(cat
            .languages()
            .iter()
            .all(|l| l.slug == l.tag.to_lowercase()));
    }

    #[test]
    fn languages_resolve_through_the_registry() {
        let cat = Catalogue::bundled().unwrap();
        assert_eq!(cat.resolve_language("isiZulu"), vec!["zul".to_string()]);
        assert_eq!(cat.resolve_language("eng-ng"), vec!["eng-NG".to_string()]);
        assert!(cat.resolve_language("").is_empty());
        assert_eq!(cat.language("sna").map(|l| l.name.as_str()), Some("Shona"));
        assert!(cat.language_codes().len() >= 300);
    }

    #[test]
    fn unverified_hours_are_excluded_from_totals() {
        let cat = Catalogue::bundled().unwrap();
        let naive: f64 = cat.all().iter().filter_map(|d| d.hours_num).sum();
        let counted = cat.stats().hours;
        assert!(counted < naive, "unverified hours must be excluded");
        for d in cat.all().iter().filter(|d| d.unverified_size) {
            assert_eq!(d.countable_hours(), None);
        }
    }
}
