//! Language identity: the ISO 639-3 registry and the rules that resolve a
//! caller-supplied language onto canonical tags.
//!
//! Every language in ngano is a BCP 47 tag whose primary subtag is a lowercase
//! ISO 639-3 three-letter code, with an optional uppercase ISO 3166-1 region
//! subtag for a country-specific variety. Shona is `sna`, Nigerian English is
//! `eng-NG`, Mozambican Portuguese is `por-MZ`. The same registry and the same
//! resolution order are used by the ngano HTTP API and by the Python and
//! JavaScript SDKs, so a filter written against one of them behaves identically
//! here.

use std::collections::HashMap;
use std::fmt;
use std::sync::{Arc, OnceLock};

use serde::de::{MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};

use crate::error::Result;

/// The ISO 639-3 registry compiled into this crate.
const BUNDLED_LANGUAGE_CODES: &str = include_str!(concat!(env!("OUT_DIR"), "/language_codes.json"));

/// One entry of the language registry: a canonical tag and everything known
/// about it, including every catalogue spelling that resolves to it.
///
/// ```
/// let cat = ngano::Catalogue::bundled()?;
/// let eng_ng = cat
///     .language_codes()
///     .iter()
///     .find(|c| c.tag == "eng-NG")
///     .expect("the registry lists Nigerian English");
/// assert_eq!(eng_ng.iso639_3, "eng");
/// assert_eq!(eng_ng.region.as_deref(), Some("NG"));
/// # Ok::<(), ngano::NganoError>(())
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LanguageCode {
    /// The canonical BCP 47 tag, for example `sna` or `eng-NG`.
    pub tag: String,
    /// The bare ISO 639-3 code behind the tag, for example `eng` for `eng-NG`.
    pub iso639_3: String,
    /// The ISO 3166-1 alpha-2 region subtag, when the tag names a
    /// country-specific variety. `None` for a language at large.
    #[serde(default)]
    pub region: Option<String>,
    /// Canonical display name.
    pub name: String,
    /// ISO 639-3 scope: `I` individual, `M` macrolanguage, `S` special.
    #[serde(default)]
    pub scope: Option<String>,
    /// ISO 639-3 type: `L` living, `E` extinct, `C` constructed, and so on.
    /// Named `kind` because `type` is a Rust keyword.
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    /// Every catalogue spelling that resolves to this tag.
    #[serde(default)]
    pub aliases: Vec<String>,
    /// How the entry was settled, for example `curated`.
    #[serde(default)]
    pub resolution: Option<String>,
}

/// The language registry: every known tag, with the name and alias tables used
/// to resolve one.
///
/// Cloning is cheap: the tables sit behind an [`Arc`].
#[derive(Debug, Clone)]
pub struct LanguageRegistry {
    inner: Arc<RegistryInner>,
}

/// The owned contents of a registry.
#[derive(Debug)]
struct RegistryInner {
    version: u32,
    codes: Vec<LanguageCode>,
    /// Canonical tag to its index in `codes`.
    by_tag: HashMap<String, usize>,
    /// Bare ISO 639-3 code to every tag using it, in registry order.
    by_code: HashMap<String, Vec<String>>,
    /// A lowercased or slugified spelling to the tag it names.
    by_alias: HashMap<String, String>,
}

/// The registry as it is written in `language_codes.json`.
#[derive(Debug, Deserialize)]
struct RawRegistry {
    #[serde(default)]
    version: u32,
    #[serde(deserialize_with = "ordered_codes")]
    codes: Vec<LanguageCode>,
    /// Source spellings that the registry entries themselves do not repeat.
    /// An empty tag marks a description that is not a language, and is skipped.
    #[serde(default)]
    name_to_tag: HashMap<String, String>,
}

/// Read the `codes` object into a vector, keeping the order of the document so
/// that a widened bare code lists its varieties in registry order.
fn ordered_codes<'de, D>(deserializer: D) -> std::result::Result<Vec<LanguageCode>, D::Error>
where
    D: Deserializer<'de>,
{
    struct CodesVisitor;

    impl<'de> Visitor<'de> for CodesVisitor {
        type Value = Vec<LanguageCode>;

        fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("a map of language tag to registry entry")
        }

        fn visit_map<M>(self, mut access: M) -> std::result::Result<Self::Value, M::Error>
        where
            M: MapAccess<'de>,
        {
            let mut out = Vec::with_capacity(access.size_hint().unwrap_or(0));
            while let Some((_, value)) = access.next_entry::<String, LanguageCode>()? {
                out.push(value);
            }
            Ok(out)
        }
    }

    deserializer.deserialize_map(CodesVisitor)
}

impl LanguageRegistry {
    /// The registry compiled into this crate. Never touches the network.
    ///
    /// ```
    /// let reg = ngano::LanguageRegistry::bundled()?;
    /// assert_eq!(reg.resolve("isiZulu", false), vec!["zul".to_string()]);
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn bundled() -> Result<Self> {
        Ok(Self::shared().clone())
    }

    /// The process-wide bundled registry, parsed once.
    ///
    /// The JSON is compiled into the binary, so a parse failure here is a build
    /// integrity problem rather than anything a caller could recover from, and
    /// the test suite parses it on every run.
    pub(crate) fn shared() -> &'static Self {
        static SHARED: OnceLock<LanguageRegistry> = OnceLock::new();
        SHARED.get_or_init(|| {
            Self::from_json(BUNDLED_LANGUAGE_CODES).expect("bundled language_codes.json parses")
        })
    }

    /// Parse a registry from the JSON shape of `language_codes.json`.
    pub fn from_json(raw: &str) -> Result<Self> {
        let doc: RawRegistry = serde_json::from_str(raw)?;
        Ok(Self::from_raw(doc))
    }

    /// Build the lookup tables. Where two spellings collide the first one wins,
    /// and registry entries are read before the source-name index.
    fn from_raw(doc: RawRegistry) -> Self {
        let mut by_tag = HashMap::with_capacity(doc.codes.len());
        let mut by_code: HashMap<String, Vec<String>> = HashMap::new();
        let mut by_alias: HashMap<String, String> = HashMap::new();

        for (i, code) in doc.codes.iter().enumerate() {
            by_tag.insert(code.tag.clone(), i);
            by_code
                .entry(code.iso639_3.clone())
                .or_default()
                .push(code.tag.clone());
        }
        for code in &doc.codes {
            add_alias(&mut by_alias, &code.name, &code.tag);
            for alias in &code.aliases {
                add_alias(&mut by_alias, alias, &code.tag);
            }
        }
        // The source-name index carries spellings the registry entries do not
        // repeat. An empty tag there marks a description, not a language.
        let mut extra: Vec<(&String, &String)> = doc.name_to_tag.iter().collect();
        extra.sort_unstable();
        for (name, tag) in extra {
            if !tag.is_empty() && by_tag.contains_key(tag) {
                add_alias(&mut by_alias, name, tag);
            }
        }

        Self {
            inner: Arc::new(RegistryInner {
                version: doc.version,
                codes: doc.codes,
                by_tag,
                by_code,
                by_alias,
            }),
        }
    }

    /// The registry version, as published in `language_codes.json`.
    pub fn version(&self) -> u32 {
        self.inner.version
    }

    /// Every registry entry, in registry order.
    pub fn codes(&self) -> &[LanguageCode] {
        &self.inner.codes
    }

    /// Every canonical tag, in registry order.
    pub fn tags(&self) -> impl Iterator<Item = &str> {
        self.inner.codes.iter().map(|c| c.tag.as_str())
    }

    /// The entry for an exact tag, matched case-insensitively.
    ///
    /// ```
    /// let reg = ngano::LanguageRegistry::bundled()?;
    /// assert_eq!(reg.get("ENG-ng").map(|c| c.tag.as_str()), Some("eng-NG"));
    /// assert!(reg.get("Shona").is_none()); // a name, not a tag
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn get(&self, tag: &str) -> Option<&LanguageCode> {
        let canonical = canonicalise_tag(tag)?;
        self.inner
            .by_tag
            .get(&canonical)
            .map(|i| &self.inner.codes[*i])
    }

    /// Every tag sharing a bare ISO 639-3 code, in registry order, so `eng`
    /// gives `eng`, `eng-NG`, `eng-ZA` and the rest.
    pub fn tags_for_code(&self, code: &str) -> &[String] {
        self.inner
            .by_code
            .get(&code.trim().to_lowercase())
            .map_or(&[][..], Vec::as_slice)
    }

    /// Resolve one caller-supplied language to canonical tags, first match wins:
    ///
    /// 1. an exact tag, case-insensitively, so `sna`, `SNA`, `eng-NG` and
    ///    `eng-ng` all land on the same entry;
    /// 2. a bare ISO 639-3 code that exists only as regional varieties, which
    ///    resolves to those varieties, because there is nothing else it could
    ///    mean;
    /// 3. a name from the registry aliases, case-insensitively, in its plain or
    ///    its slugified spelling, which is how a free-text name still works.
    ///
    /// A tag always beats a name. The one collision in the catalogue is `tem`,
    /// which is the tag for Timne and is also the name of `kdh`: the tag wins,
    /// so `kdh` is reached by its own tag rather than by that name.
    ///
    /// A bare code never widens to its regional varieties unless
    /// `include_varieties` is true, in which case the bare tag comes first and
    /// every `<code>-*` variety follows in registry order.
    ///
    /// Nothing that matches gives an empty vector. Input is never guessed at.
    ///
    /// ```
    /// let reg = ngano::LanguageRegistry::bundled()?;
    /// assert_eq!(reg.resolve("SNA", false), vec!["sna".to_string()]);
    /// assert_eq!(reg.resolve("tem", false), vec!["tem".to_string()]); // Timne's tag
    /// assert_eq!(reg.resolve("isiZulu", false), vec!["zul".to_string()]); // a name
    /// assert_eq!(reg.resolve("eng", false), vec!["eng".to_string()]);
    /// assert!(reg.resolve("eng", true).len() > 1);
    /// assert!(reg.resolve("not a language", false).is_empty());
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn resolve(&self, value: &str, include_varieties: bool) -> Vec<String> {
        let raw = value.trim();
        if raw.is_empty() {
            return Vec::new();
        }

        if let Some(tag) = canonicalise_tag(raw) {
            let varieties: &[String] = if tag.contains('-') {
                &[]
            } else {
                self.tags_for_code(&tag)
            };
            if self.inner.by_tag.contains_key(&tag) {
                if !include_varieties || varieties.is_empty() {
                    return vec![tag];
                }
                let mut out = vec![tag.clone()];
                out.extend(varieties.iter().filter(|t| **t != tag).cloned());
                return out;
            }
            if !varieties.is_empty() {
                return varieties.to_vec();
            }
        }

        let Some(tag) = self
            .inner
            .by_alias
            .get(&raw.to_lowercase())
            .or_else(|| self.inner.by_alias.get(&slugify(raw)))
            .cloned()
        else {
            return Vec::new();
        };
        if include_varieties {
            if let Some(entry) = self.get(&tag) {
                if entry.region.is_none() {
                    let varieties = self.tags_for_code(&entry.iso639_3);
                    if varieties.len() > 1 {
                        let mut out = vec![tag.clone()];
                        out.extend(varieties.iter().filter(|t| **t != tag).cloned());
                        return out;
                    }
                }
            }
        }
        vec![tag]
    }

    /// Resolve several values at once, deduplicated, order preserved.
    pub fn resolve_all<I, S>(&self, values: I, include_varieties: bool) -> Vec<String>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let mut out: Vec<String> = Vec::new();
        for value in values {
            for tag in self.resolve(value.as_ref(), include_varieties) {
                if !out.contains(&tag) {
                    out.push(tag);
                }
            }
        }
        out
    }
}

/// Record a spelling against a tag, plain and slugified. First one wins.
fn add_alias(map: &mut HashMap<String, String>, name: &str, tag: &str) {
    let lower = name.trim().to_lowercase();
    if lower.is_empty() {
        return;
    }
    map.entry(lower.clone()).or_insert_with(|| tag.to_string());
    let slug = slugify(&lower);
    if !slug.is_empty() {
        map.entry(slug).or_insert_with(|| tag.to_string());
    }
}

/// Put a tag into canonical case: lowercase primary subtag, uppercase region.
/// `None` when the value is not tag-shaped at all.
///
/// The shape is the one BCP 47 allows for these tags: three letters, optionally
/// followed by a two-letter region or a three-digit UN M.49 area.
///
/// ```
/// assert_eq!(ngano::canonicalise_tag("ENG-ng").as_deref(), Some("eng-NG"));
/// assert_eq!(ngano::canonicalise_tag("Shona"), None);
/// ```
pub fn canonicalise_tag(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let (primary, region) = match trimmed.split_once('-') {
        Some((p, r)) => (p, Some(r)),
        None => (trimmed, None),
    };
    if primary.len() != 3 || !primary.chars().all(|c| c.is_ascii_alphabetic()) {
        return None;
    }
    let primary = primary.to_ascii_lowercase();
    match region {
        None => Some(primary),
        Some(r) if r.len() == 2 && r.chars().all(|c| c.is_ascii_alphabetic()) => {
            Some(format!("{primary}-{}", r.to_ascii_uppercase()))
        }
        Some(r) if r.len() == 3 && r.chars().all(|c| c.is_ascii_digit()) => {
            Some(format!("{primary}-{r}"))
        }
        Some(_) => None,
    }
}

/// The slug rule the name-based language URLs used, kept so a name written in
/// any spelling still resolves: lowercase, strip accents, and reduce every run
/// of other characters to a single hyphen.
fn slugify(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut pending_hyphen = false;
    for c in value.chars().flat_map(fold_char) {
        if c.is_ascii_alphanumeric() {
            if pending_hyphen && !out.is_empty() {
                out.push('-');
            }
            pending_hyphen = false;
            out.push(c.to_ascii_lowercase());
        } else {
            pending_hyphen = true;
        }
    }
    out
}

/// Accented Latin letters, and the ASCII letters they fold to. The two strings
/// line up character by character.
const FOLD_FROM: &str =
    "ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÇçÐðÑñÝýÿŠšŽžĀāĒēĪīŌōŪūŴŵŶŷ";
/// The ASCII letters [`FOLD_FROM`] folds to, in the same order.
const FOLD_TO: &str = "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuCcDdNnYyySsZzAaEeIiOoUuWwYy";

/// Fold one character towards ASCII. Combining marks vanish, `æ` and `ß` expand,
/// and anything else is left for [`slugify`] to treat as a separator.
fn fold_char(c: char) -> Vec<char> {
    if c.is_ascii() {
        return vec![c];
    }
    if ('\u{0300}'..='\u{036f}').contains(&c) {
        return Vec::new();
    }
    match c {
        'Æ' => return vec!['A', 'E'],
        'æ' => return vec!['a', 'e'],
        'ß' => return vec!['s', 's'],
        _ => {}
    }
    match FOLD_FROM.chars().position(|f| f == c) {
        Some(i) => FOLD_TO.chars().nth(i).map(|f| vec![f]).unwrap_or_default(),
        None => vec![c],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn registry() -> &'static LanguageRegistry {
        LanguageRegistry::shared()
    }

    #[test]
    fn the_fold_table_lines_up() {
        assert_eq!(FOLD_FROM.chars().count(), FOLD_TO.chars().count());
    }

    #[test]
    fn slugs_strip_accents_and_punctuation() {
        assert_eq!(slugify("Sängö"), "sango");
        assert_eq!(slugify("N'Ko  (script)"), "n-ko-script");
        assert_eq!(slugify("isiZulu"), "isizulu");
    }

    #[test]
    fn tags_are_canonicalised_case_and_shape() {
        assert_eq!(canonicalise_tag("sna").as_deref(), Some("sna"));
        assert_eq!(canonicalise_tag("SNA").as_deref(), Some("sna"));
        assert_eq!(canonicalise_tag("eng-ng").as_deref(), Some("eng-NG"));
        assert_eq!(canonicalise_tag(" ENG-NG ").as_deref(), Some("eng-NG"));
        assert_eq!(canonicalise_tag("und-419").as_deref(), Some("und-419"));
        assert_eq!(canonicalise_tag("en"), None);
        assert_eq!(canonicalise_tag("english"), None);
        assert_eq!(canonicalise_tag("eng-NGA"), None);
    }

    #[test]
    fn the_registry_is_read_in_document_order() {
        let reg = registry();
        let english = reg.tags_for_code("eng");
        // Registry order, not sorted order: `eng-NG` is catalogued first.
        assert_eq!(english.first().map(String::as_str), Some("eng-NG"));
        assert!(english.contains(&"eng".to_string()));
        // Widening still puts the bare tag first, then every variety.
        let widened = reg.resolve("eng", true);
        assert_eq!(widened.first().map(String::as_str), Some("eng"));
        assert_eq!(widened.len(), english.len());
        assert!(reg.codes().len() >= 300);
        assert_eq!(reg.version(), 1);
    }

    #[test]
    fn a_bare_code_that_is_only_regional_resolves_to_its_varieties() {
        let reg = registry();
        // German is catalogued only as the Namibian variety.
        assert!(reg.get("deu").is_none());
        assert_eq!(reg.resolve("deu", false), vec!["deu-NA".to_string()]);
    }
}
