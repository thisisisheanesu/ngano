//! Dataset selection.

use crate::language::LanguageRegistry;
use crate::model::Dataset;

/// A declarative dataset filter.
///
/// Values given to the same method are combined with OR, and different methods
/// are combined with AND. Every string comparison is case-insensitive.
///
/// ```
/// use ngano::{Catalogue, Filter};
///
/// let cat = Catalogue::bundled()?;
/// let f = Filter::new().language("sna").commercial(true).task("ASR");
/// for d in cat.datasets(&f) {
///     assert!(d.allows_commercial_use());
/// }
/// # Ok::<(), ngano::NganoError>(())
/// ```
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Filter {
    /// Free-text query applied to name, id, languages, countries and notes.
    pub q: Option<String>,
    /// Languages to keep, each written as a bare ISO 639-3 code, a BCP 47 tag
    /// or a name. Every value is resolved to canonical tags and matched against
    /// [`Dataset::language_tags`].
    pub languages: Vec<String>,
    /// Widen a bare ISO 639-3 code to every regional variety of it, so `eng`
    /// also matches `eng-NG` and `eng-ZA`.
    pub include_varieties: bool,
    /// Countries, given as ISO 3166-1 alpha-2 codes or as names.
    pub countries: Vec<String>,
    /// Regional groupings.
    pub regions: Vec<String>,
    /// Tasks, for example `ASR`.
    pub tasks: Vec<String>,
    /// Language varieties.
    pub varieties: Vec<String>,
    /// Licence families.
    pub licence_classes: Vec<String>,
    /// Access modes.
    pub access: Vec<String>,
    /// Labelling states.
    pub labelled: Vec<String>,
    /// Quality bands.
    pub quality: Vec<String>,
    /// Recording domains.
    pub domains: Vec<String>,
    /// Hosts, for example `HuggingFace`.
    pub hosts: Vec<String>,
    /// `Some(true)` keeps datasets usable commercially (`Yes` or
    /// `Yes, if purchased`), `Some(false)` keeps only those that are not.
    pub commercial: Option<bool>,
    /// `Some(true)` keeps only datasets with a Hugging Face repo.
    pub hf_only: Option<bool>,
    /// `Some(true)` keeps only datasets with a numeric hours figure.
    pub has_hours: Option<bool>,
    /// Lower bound on countable hours, inclusive.
    pub min_hours: Option<f64>,
    /// Upper bound on countable hours, inclusive.
    pub max_hours: Option<f64>,
    /// When true, drop records whose size is self-reported and unverified.
    pub exclude_unverified: bool,
}

macro_rules! push_setter {
    ($(#[$m:meta])* $name:ident, $field:ident) => {
        $(#[$m])*
        #[must_use]
        pub fn $name(mut self, value: impl Into<String>) -> Self {
            self.$field.push(value.into());
            self
        }
    };
}

impl Filter {
    /// An empty filter, which matches every record.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Free-text query over name, id, languages, countries, domain and notes.
    #[must_use]
    pub fn q(mut self, value: impl Into<String>) -> Self {
        self.q = Some(value.into());
        self
    }

    push_setter!(
        /// Add a language to match, written as a bare ISO 639-3 code (`sna`),
        /// a BCP 47 tag (`eng-NG`) or a name (`Shona`, `isiZulu`). Case does
        /// not matter, and an unresolvable value simply matches nothing.
        language, languages);
    push_setter!(
        /// Add a language by its ISO 639-3 code. This is the code-shaped
        /// spelling of [`Filter::language`] and resolves identically.
        iso, languages);
    push_setter!(
        /// Add a country, as an ISO 3166-1 alpha-2 code or a name.
        country, countries);
    push_setter!(
        /// Add a regional grouping to match.
        region, regions);
    push_setter!(
        /// Add a task to match, for example `ASR`.
        task, tasks);
    push_setter!(
        /// Add a language variety to match.
        variety, varieties);
    push_setter!(
        /// Add a licence family to match.
        licence_class, licence_classes);
    push_setter!(
        /// Add an access mode to match, for example `Open`.
        access_mode, access);
    push_setter!(
        /// Add a labelling state to match, for example `Transcribed`.
        labelled, labelled);
    push_setter!(
        /// Add a quality band to match.
        quality, quality);
    push_setter!(
        /// Add a recording domain to match.
        domain, domains);
    push_setter!(
        /// Add a host to match, for example `HuggingFace`.
        host, hosts);

    /// Keep datasets by commercial usability. `true` keeps `Yes` and
    /// `Yes, if purchased`, `false` keeps everything else.
    #[must_use]
    pub fn commercial(mut self, value: bool) -> Self {
        self.commercial = Some(value);
        self
    }

    /// Widen every bare ISO 639-3 code given to [`Filter::language`] to its
    /// regional varieties, so `eng` also keeps `eng-NG` and `eng-ZA`. Off by
    /// default: a bare code means the language at large and must never silently
    /// pick up a country-specific variety.
    ///
    /// ```
    /// use ngano::{Catalogue, Filter};
    ///
    /// let cat = Catalogue::bundled()?;
    /// let plain = cat.datasets(&Filter::new().language("eng"));
    /// let wide = cat.datasets(&Filter::new().language("eng").include_varieties(true));
    /// assert!(wide.len() > plain.len());
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    #[must_use]
    pub fn include_varieties(mut self, value: bool) -> Self {
        self.include_varieties = value;
        self
    }

    /// Keep only datasets hosted on Hugging Face, which are the streamable ones.
    #[must_use]
    pub fn hf_only(mut self, value: bool) -> Self {
        self.hf_only = Some(value);
        self
    }

    /// Keep only datasets that publish a numeric hours figure.
    #[must_use]
    pub fn has_hours(mut self, value: bool) -> Self {
        self.has_hours = Some(value);
        self
    }

    /// Lower bound on countable hours, inclusive.
    #[must_use]
    pub fn min_hours(mut self, value: f64) -> Self {
        self.min_hours = Some(value);
        self
    }

    /// Upper bound on countable hours, inclusive.
    #[must_use]
    pub fn max_hours(mut self, value: f64) -> Self {
        self.max_hours = Some(value);
        self
    }

    /// Drop records whose published size is self-reported and unverified.
    #[must_use]
    pub fn exclude_unverified(mut self, value: bool) -> Self {
        self.exclude_unverified = value;
        self
    }

    /// The canonical BCP 47 tags this filter keeps, deduplicated and in the
    /// order the languages were added. A value that resolves to nothing
    /// contributes nothing, so a filter written only of unknown languages keeps
    /// no records at all.
    ///
    /// ```
    /// use ngano::Filter;
    ///
    /// let f = Filter::new().language("isiZulu").iso("sna");
    /// assert_eq!(f.resolved_languages(), vec!["zul".to_string(), "sna".to_string()]);
    /// ```
    pub fn resolved_languages(&self) -> Vec<String> {
        LanguageRegistry::shared().resolve_all(&self.languages, self.include_varieties)
    }

    /// Languages given to this filter that the registry does not recognise.
    /// Useful for telling a caller that a spelling matched nothing, rather than
    /// silently returning an empty result.
    pub fn unresolved_languages(&self) -> Vec<String> {
        let registry = LanguageRegistry::shared();
        self.languages
            .iter()
            .filter(|v| registry.resolve(v, self.include_varieties).is_empty())
            .cloned()
            .collect()
    }

    /// True when this filter would keep every record.
    pub fn is_empty(&self) -> bool {
        *self == Filter::default()
    }

    /// Test one record against the filter.
    ///
    /// ```
    /// use ngano::{Catalogue, Filter};
    ///
    /// let cat = Catalogue::bundled()?;
    /// let d = cat.all().first().expect("catalogue is not empty");
    /// assert!(Filter::new().matches(d));
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn matches(&self, d: &Dataset) -> bool {
        if self.exclude_unverified && d.unverified_size {
            return false;
        }
        if let Some(want) = self.commercial {
            if d.allows_commercial_use() != want {
                return false;
            }
        }
        if self.hf_only == Some(true) && !d.is_streamable() {
            return false;
        }
        if self.hf_only == Some(false) && d.is_streamable() {
            return false;
        }
        if let Some(want) = self.has_hours {
            if d.hours_num.is_some() != want {
                return false;
            }
        }
        if self.min_hours.is_some() || self.max_hours.is_some() {
            let Some(h) = d.countable_hours() else {
                return false;
            };
            if self.min_hours.is_some_and(|m| h < m) || self.max_hours.is_some_and(|m| h > m) {
                return false;
            }
        }
        if !any_match(&self.tasks, std::slice::from_ref(&d.task))
            || !any_match(&self.varieties, std::slice::from_ref(&d.variety))
            || !any_match(
                &self.licence_classes,
                std::slice::from_ref(&d.licence_class),
            )
            || !any_match(&self.access, std::slice::from_ref(&d.access))
            || !any_match(&self.labelled, std::slice::from_ref(&d.labelled))
            || !any_match(&self.quality, std::slice::from_ref(&d.quality))
            || !any_match(&self.domains, std::slice::from_ref(&d.domain))
            || !any_match(&self.hosts, std::slice::from_ref(&d.host))
            || !any_match(&self.regions, &d.regions)
        {
            return false;
        }
        if !self.languages.is_empty() {
            let wanted = self.resolved_languages();
            if !d
                .language_tags
                .iter()
                .any(|tag| wanted.iter().any(|w| w.eq_ignore_ascii_case(tag)))
            {
                return false;
            }
        }
        if !any_match_either(&self.countries, &d.country_codes, &d.countries) {
            return false;
        }
        if let Some(q) = &self.q {
            if !matches_query(d, q) {
                return false;
            }
        }
        true
    }
}

/// True when `wanted` is empty, or when any wanted value equals any candidate,
/// ignoring case.
fn any_match(wanted: &[String], candidates: &[String]) -> bool {
    if wanted.is_empty() {
        return true;
    }
    wanted.iter().any(|w| {
        candidates
            .iter()
            .any(|c| c.eq_ignore_ascii_case(w.trim()) || c.trim().eq_ignore_ascii_case(w.trim()))
    })
}

/// True when `wanted` is empty, or when it matches either candidate list.
fn any_match_either(wanted: &[String], first: &[String], second: &[String]) -> bool {
    if wanted.is_empty() {
        return true;
    }
    any_match(wanted, first) || any_match(wanted, second)
}

/// Case-insensitive substring search across the fields a human would search.
fn matches_query(d: &Dataset, q: &str) -> bool {
    let needle = q.trim().to_lowercase();
    if needle.is_empty() {
        return true;
    }
    let mut haystack = String::with_capacity(256);
    haystack.push_str(&d.name);
    haystack.push('\n');
    haystack.push_str(&d.id);
    haystack.push('\n');
    haystack.push_str(&d.domain);
    haystack.push('\n');
    haystack.push_str(&d.notes);
    haystack.push('\n');
    if let Some(r) = &d.hf_repo {
        haystack.push_str(r);
        haystack.push('\n');
    }
    for list in [
        &d.languages,
        &d.languages_clean,
        &d.language_tags,
        &d.countries,
        &d.regions,
    ] {
        for v in list {
            haystack.push_str(v);
            haystack.push('\n');
        }
    }
    haystack.to_lowercase().contains(&needle)
}
