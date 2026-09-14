//! Column mapping: heterogeneous source columns onto the canonical row schema.
//!
//! The four steps below run in exactly this order, and match the Python and
//! JavaScript SDKs:
//!
//! 1. `overrides[hf_repo]` from `field_map.json`, for repos with a known schema.
//! 2. runtime inspection of the dataset's actual columns against `aliases`,
//!    comparing case-insensitively and ignoring underscores and hyphens.
//! 3. `unit_hints` conversions, for example `duration_ms` into `duration_s`.
//! 4. every column still unmapped is preserved in [`Row::extra`].
//!
//! Finally, columns named in `drop` are discarded rather than kept in `extra`.
//! An unrecognised schema is never an error: unmatched fields become `None`.

use std::collections::{BTreeMap, BTreeSet};

use serde::Deserialize;
use serde_json::{Map, Value};

use crate::error::Result;
use crate::row::{as_f64, as_text, as_u32, AudioRef, Row, RowContext};

/// The mapping table compiled into this crate.
const BUNDLED_FIELD_MAP: &str = include_str!(concat!(env!("OUT_DIR"), "/field_map.json"));

/// Canonical fields, in the precedence order used when two fields could claim
/// the same column.
pub const CANONICAL_FIELDS: [&str; 13] = [
    "transcript",
    "audio",
    "language",
    "language_iso",
    "speaker_id",
    "gender",
    "age",
    "duration_s",
    "sampling_rate",
    "country",
    "domain",
    "split",
    "language_tag",
];

/// Lowercase a name and strip underscores and hyphens, so `WAV_Path`, `wav-path`
/// and `wavpath` all compare equal.
///
/// ```
/// assert_eq!(ngano::normalise_column("Client_ID"), "clientid");
/// assert_eq!(ngano::normalise_column("lang-id"), "langid");
/// ```
pub fn normalise_column(name: &str) -> String {
    name.chars()
        .filter(|c| *c != '_' && *c != '-')
        .flat_map(char::to_lowercase)
        .collect()
}

/// A unit conversion from a source column onto a canonical field.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct UnitHint {
    /// The canonical field the converted value belongs to.
    canonical: &'static str,
    /// The factor applied to the source value.
    multiply: f64,
}

/// Where one canonical field gets its value from.
#[derive(Debug, Clone, PartialEq)]
pub struct Binding {
    /// The source column name, exactly as the dataset spells it.
    pub column: String,
    /// A unit conversion factor, when the source column is in other units.
    pub multiply: Option<f64>,
}

/// The parsed contents of `field_map.json`.
///
/// ```
/// use ngano::FieldMap;
///
/// let fm = FieldMap::bundled()?;
/// let columns = ["sentence".to_string(), "client_id".to_string(), "locale".to_string()];
/// let map = fm.resolve(None, &columns);
/// assert_eq!(map.column("transcript"), Some("sentence"));
/// assert_eq!(map.column("speaker_id"), Some("client_id"));
/// # Ok::<(), ngano::NganoError>(())
/// ```
#[derive(Debug, Clone)]
pub struct FieldMap {
    version: u32,
    aliases: BTreeMap<String, Vec<String>>,
    drop: BTreeSet<String>,
    unit_hints: BTreeMap<String, UnitHint>,
    overrides: BTreeMap<String, BTreeMap<String, String>>,
}

/// The on-disk shape of `field_map.json`.
#[derive(Debug, Deserialize)]
struct RawFieldMap {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    aliases: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    drop: Vec<String>,
    #[serde(default)]
    unit_hints: BTreeMap<String, RawUnitHint>,
    #[serde(default)]
    overrides: BTreeMap<String, BTreeMap<String, Value>>,
}

/// The on-disk shape of one `unit_hints` entry.
#[derive(Debug, Deserialize)]
struct RawUnitHint {
    canonical: String,
    multiply: f64,
}

impl FieldMap {
    /// Load the mapping table compiled into the binary. Never touches the network.
    pub fn bundled() -> Result<Self> {
        Self::from_json(BUNDLED_FIELD_MAP)
    }

    /// Parse a mapping table, for example the body of `GET /schema`.
    pub fn from_json(json: &str) -> Result<Self> {
        let raw: RawFieldMap = serde_json::from_str(json)?;
        Ok(Self::from_raw(raw))
    }

    fn from_raw(raw: RawFieldMap) -> Self {
        let unit_hints = raw
            .unit_hints
            .into_iter()
            .filter_map(|(k, v)| {
                let canonical = CANONICAL_FIELDS
                    .iter()
                    .find(|c| **c == v.canonical)
                    .copied()?;
                Some((
                    normalise_column(&k),
                    UnitHint {
                        canonical,
                        multiply: v.multiply,
                    },
                ))
            })
            .collect();
        let overrides = raw
            .overrides
            .into_iter()
            .map(|(repo, fields)| {
                let kept = fields
                    .into_iter()
                    .filter_map(|(field, value)| {
                        let column = value.as_str()?.to_string();
                        CANONICAL_FIELDS
                            .contains(&field.as_str())
                            .then_some((field, column))
                    })
                    .collect();
                (repo.to_lowercase(), kept)
            })
            .collect();
        Self {
            version: raw.version,
            aliases: raw.aliases,
            drop: raw.drop.iter().map(|d| normalise_column(d)).collect(),
            unit_hints,
            overrides,
        }
    }

    /// The `version` field of the mapping table.
    pub fn version(&self) -> u32 {
        self.version
    }

    /// True when `field_map.json` carries a hand-verified override for this repo.
    ///
    /// ```
    /// let fm = ngano::FieldMap::bundled()?;
    /// assert!(fm.has_override("google/fleurs"));
    /// assert!(!fm.has_override("some-org/unknown-corpus"));
    /// # Ok::<(), ngano::NganoError>(())
    /// ```
    pub fn has_override(&self, hf_repo: &str) -> bool {
        self.overrides.contains_key(&hf_repo.to_lowercase())
    }

    /// Resolve a dataset's columns onto the canonical schema.
    ///
    /// `hf_repo` selects a repo override when one exists. `columns` is the list
    /// of column names the dataset actually exposes.
    pub fn resolve(&self, hf_repo: Option<&str>, columns: &[String]) -> ColumnMap {
        // Index the real columns by their normalised spelling, first wins.
        let mut by_norm: BTreeMap<String, String> = BTreeMap::new();
        for c in columns {
            by_norm
                .entry(normalise_column(c))
                .or_insert_with(|| c.clone());
        }

        let mut bindings: BTreeMap<String, Binding> = BTreeMap::new();
        let mut consumed: BTreeSet<String> = BTreeSet::new();

        // Step 1: repo overrides.
        if let Some(repo) = hf_repo {
            if let Some(fields) = self.overrides.get(&repo.to_lowercase()) {
                for field in CANONICAL_FIELDS {
                    let Some(wanted) = fields.get(field) else {
                        continue;
                    };
                    if let Some(actual) = by_norm.get(&normalise_column(wanted)) {
                        if consumed.contains(actual) {
                            continue;
                        }
                        consumed.insert(actual.clone());
                        bindings.insert(field.to_string(), self.bind(field, actual));
                    }
                }
            }
        }

        // Step 2: alias inspection, in canonical precedence order.
        for field in CANONICAL_FIELDS {
            if bindings.contains_key(field) {
                continue;
            }
            let Some(aliases) = self.aliases.get(field) else {
                continue;
            };
            for alias in aliases {
                if let Some(actual) = by_norm.get(&normalise_column(alias)) {
                    if consumed.contains(actual) {
                        continue;
                    }
                    consumed.insert(actual.clone());
                    bindings.insert(field.to_string(), self.bind(field, actual));
                    break;
                }
            }
        }

        // Step 3: unit hints, for source columns in other units.
        for (hint_key, hint) in &self.unit_hints {
            if bindings.contains_key(hint.canonical) {
                continue;
            }
            let mut candidates: Vec<String> = vec![hint_key.clone()];
            // `duration_ms` is spelled with an underscore in `aliases`, so look
            // its alias list up by the normalised key.
            for (key, list) in &self.aliases {
                if normalise_column(key) == *hint_key {
                    candidates.extend(list.iter().map(|a| normalise_column(a)));
                }
            }
            for candidate in candidates {
                if let Some(actual) = by_norm.get(&candidate) {
                    if consumed.contains(actual) {
                        continue;
                    }
                    consumed.insert(actual.clone());
                    bindings.insert(
                        hint.canonical.to_string(),
                        Binding {
                            column: actual.clone(),
                            multiply: Some(hint.multiply),
                        },
                    );
                    break;
                }
            }
        }

        ColumnMap {
            bindings,
            consumed,
            drop: self.drop.clone(),
        }
    }

    /// Bind a field to a column, attaching a unit factor when the column itself
    /// is in other units (an override may point `duration_s` at `duration_ms`).
    fn bind(&self, field: &str, column: &str) -> Binding {
        let multiply = self
            .unit_hints
            .get(&normalise_column(column))
            .filter(|h| h.canonical == field)
            .map(|h| h.multiply);
        Binding {
            column: column.to_string(),
            multiply,
        }
    }
}

/// A resolved mapping from one dataset's columns onto the canonical schema.
#[derive(Debug, Clone)]
pub struct ColumnMap {
    bindings: BTreeMap<String, Binding>,
    consumed: BTreeSet<String>,
    drop: BTreeSet<String>,
}

impl ColumnMap {
    /// The source column bound to a canonical field, if any.
    pub fn column(&self, field: &str) -> Option<&str> {
        self.bindings.get(field).map(|b| b.column.as_str())
    }

    /// The full binding for a canonical field, including any unit factor.
    pub fn binding(&self, field: &str) -> Option<&Binding> {
        self.bindings.get(field)
    }

    /// Every canonical field this mapping resolved, in canonical order.
    pub fn mapped_fields(&self) -> Vec<&str> {
        CANONICAL_FIELDS
            .iter()
            .filter(|f| self.bindings.contains_key(**f))
            .copied()
            .collect()
    }

    /// True when the column would be discarded rather than kept in `extra`.
    pub fn is_dropped(&self, column: &str) -> bool {
        self.drop.contains(&normalise_column(column))
    }

    /// Map one source row onto the canonical schema.
    pub(crate) fn apply(&self, source: &Map<String, Value>, ctx: &RowContext) -> Row {
        let mut row = ctx.blank_row();
        let get = |field: &str| -> Option<(&Value, Option<f64>)> {
            let b = self.bindings.get(field)?;
            let v = source.get(&b.column)?;
            if v.is_null() {
                return None;
            }
            Some((v, b.multiply))
        };

        if let Some((v, _)) = get("transcript") {
            row.transcript = as_text(v);
        }
        if let Some((v, _)) = get("language") {
            row.language = as_text(v);
        }
        if let Some((v, _)) = get("language_iso") {
            row.language_iso = as_text(v);
        }
        if let Some((v, _)) = get("language_tag") {
            row.language_tag = as_text(v);
        }
        if let Some((v, _)) = get("speaker_id") {
            row.speaker_id = as_text(v);
        }
        if let Some((v, _)) = get("gender") {
            row.gender = as_text(v);
        }
        if let Some((v, _)) = get("age") {
            row.age = as_text(v);
        }
        if let Some((v, _)) = get("domain") {
            row.domain = as_text(v);
        }
        if let Some((v, _)) = get("country") {
            row.country = as_text(v).map(|c| ctx.normalise_country(&c));
        }
        if let Some((v, _)) = get("split") {
            if let Some(s) = as_text(v) {
                row.split = s;
            }
        }
        if let Some((v, factor)) = get("duration_s") {
            row.duration_s = as_f64(v).map(|d| d * factor.unwrap_or(1.0));
        }
        if let Some((v, _)) = get("sampling_rate") {
            row.sampling_rate = as_u32(v);
        }
        if let Some((v, _)) = get("audio") {
            row.audio = AudioRef::from_value(v).map(|a| match &ctx.fetcher {
                Some(client) => a.with_fetcher(client.clone(), &ctx.hf_repo),
                None => a,
            });
        }

        for (key, value) in source {
            if self.consumed.contains(key) || self.is_dropped(key) {
                continue;
            }
            row.extra.insert(key.clone(), value.clone());
        }

        ctx.fill_defaults(&mut row);
        row
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::row::RowContext;
    use serde_json::json;

    fn cols(names: &[&str]) -> Vec<String> {
        names.iter().map(|s| s.to_string()).collect()
    }

    fn ctx() -> RowContext {
        RowContext {
            dataset_id: Some("test-dataset".to_string()),
            hf_repo: "org/repo".to_string(),
            licence: "CC-BY-4.0".to_string(),
            source_url: "https://huggingface.co/datasets/org/repo".to_string(),
            split: "train".to_string(),
            default_language: Some("Shona".to_string()),
            default_language_iso: Some("sna".to_string()),
            default_language_tag: Some("sna".to_string()),
            default_country: Some("ZW".to_string()),
            default_domain: Some("Read speech".to_string()),
            catalogue: None,
            fetcher: None,
        }
    }

    fn map_row(repo: Option<&str>, source: serde_json::Value) -> Row {
        let object = source.as_object().expect("row object").clone();
        let columns: Vec<String> = object.keys().cloned().collect();
        let fm = FieldMap::bundled().expect("bundled field map");
        fm.resolve(repo, &columns).apply(&object, &ctx())
    }

    #[test]
    fn normalisation_ignores_case_underscores_and_hyphens() {
        assert_eq!(normalise_column("WAV_PATH"), "wavpath");
        assert_eq!(normalise_column("Sampling-Rate"), "samplingrate");
        assert_eq!(normalise_column("Client_ID"), "clientid");
        assert_eq!(normalise_column("text"), "text");
    }

    #[test]
    fn common_voice_columns_map_through_the_override() {
        let fm = FieldMap::bundled().unwrap();
        let columns = cols(&[
            "client_id",
            "audio",
            "sentence",
            "up_votes",
            "down_votes",
            "age",
            "gender",
            "accent",
            "locale",
            "segment",
        ]);
        let map = fm.resolve(Some("mozilla-foundation/common_voice_17_0"), &columns);
        assert_eq!(map.column("transcript"), Some("sentence"));
        assert_eq!(map.column("speaker_id"), Some("client_id"));
        assert_eq!(map.column("language"), Some("locale"));
        assert_eq!(map.column("audio"), Some("audio"));
        assert_eq!(map.column("age"), Some("age"));
        assert_eq!(map.column("gender"), Some("gender"));
        for dropped in ["up_votes", "down_votes", "segment"] {
            assert!(map.is_dropped(dropped), "{dropped} should be dropped");
        }
        // `accent` is a country alias, so it is claimed rather than discarded.
        assert!(!map.is_dropped("accent"));
        assert_eq!(map.column("country"), Some("accent"));
    }

    #[test]
    fn common_voice_columns_map_without_the_override_too() {
        let fm = FieldMap::bundled().unwrap();
        let columns = cols(&["client_id", "audio", "sentence", "locale"]);
        let map = fm.resolve(Some("some-mirror/common_voice_clone"), &columns);
        assert_eq!(map.column("transcript"), Some("sentence"));
        assert_eq!(map.column("speaker_id"), Some("client_id"));
        assert_eq!(map.column("language"), Some("locale"));
    }

    #[test]
    fn fleurs_columns_map_through_the_override() {
        let fm = FieldMap::bundled().unwrap();
        let columns = cols(&[
            "id",
            "num_samples",
            "path",
            "audio",
            "transcription",
            "raw_transcription",
            "gender",
            "lang_id",
            "language",
            "lang_group_id",
        ]);
        let map = fm.resolve(Some("google/fleurs"), &columns);
        assert_eq!(map.column("transcript"), Some("transcription"));
        assert_eq!(map.column("language"), Some("language"));
        assert_eq!(map.column("language_iso"), Some("lang_id"));
        assert_eq!(map.column("audio"), Some("audio"));
        assert!(map.is_dropped("id"));
        assert!(map.is_dropped("num_samples"));
    }

    #[test]
    fn an_oddball_schema_maps_through_the_alias_table_alone() {
        let row = map_row(
            Some("someone/odd-corpus"),
            json!({"Text": "mhoro", "WAV_PATH": "clips/a.wav", "Notes": "field recording"}),
        );
        assert_eq!(row.transcript.as_deref(), Some("mhoro"));
        // `wav_path` is an audio alias, and matching ignores case and
        // underscores, so `WAV_PATH` is claimed by the table.
        assert_eq!(
            row.audio.as_ref().and_then(|a| a.path.as_deref()),
            Some("clips/a.wav")
        );
        assert_eq!(
            row.extra.get("Notes").and_then(|v| v.as_str()),
            Some("field recording")
        );
        // Catalogue level defaults still apply.
        assert_eq!(row.language.as_deref(), Some("Shona"));
        assert_eq!(row.country.as_deref(), Some("ZW"));
        assert_eq!(row.split, "train");
        assert_eq!(row.dataset_id.as_deref(), Some("test-dataset"));
    }

    #[test]
    fn a_stated_tag_column_is_claimed_by_the_table_and_wins() {
        let row = map_row(
            None,
            json!({"sentence": "sawubona", "bcp47": "eng-ng", "locale": "English"}),
        );
        // The tag column is claimed, canonicalised, and beats the row language.
        assert_eq!(row.language_tag.as_deref(), Some("eng-NG"));
        assert_eq!(row.language_iso.as_deref(), Some("eng"));
        assert_eq!(row.language.as_deref(), Some("English"));
        assert!(!row.extra.contains_key("bcp47"));
    }

    #[test]
    fn a_stated_tag_the_registry_does_not_know_is_kept_verbatim() {
        let row = map_row(None, json!({"sentence": "hesi", "lang_tag": "xx-YY"}));
        assert_eq!(row.language_tag.as_deref(), Some("xx-YY"));
        // Nothing resolved, so the code falls back to the catalogue record.
        assert_eq!(row.language_iso.as_deref(), Some("sna"));
    }

    #[test]
    fn a_row_language_that_resolves_settles_the_tag_and_the_code() {
        let row = map_row(None, json!({"sentence": "sawubona", "locale": "isiZulu"}));
        assert_eq!(row.language.as_deref(), Some("isiZulu"));
        assert_eq!(row.language_tag.as_deref(), Some("zul"));
        assert_eq!(row.language_iso.as_deref(), Some("zul"));
    }

    #[test]
    fn a_row_code_settles_the_tag_when_the_language_column_does_not() {
        let row = map_row(
            None,
            json!({"sentence": "salaam", "locale": "coastal dialect", "iso_639_3": "swh"}),
        );
        assert_eq!(row.language_tag.as_deref(), Some("swh"));
        assert_eq!(row.language_iso.as_deref(), Some("swh"));
        assert_eq!(row.language.as_deref(), Some("coastal dialect"));
    }

    #[test]
    fn the_code_column_is_tried_before_the_language_column() {
        // Both resolve, and they disagree. The code is the better evidence, so
        // it settles the tag while the language column is still kept verbatim.
        let row = map_row(
            None,
            json!({"sentence": "sawubona", "locale": "isiZulu", "iso_639_3": "swh"}),
        );
        assert_eq!(row.language_tag.as_deref(), Some("swh"));
        assert_eq!(row.language_iso.as_deref(), Some("swh"));
        assert_eq!(row.language.as_deref(), Some("isiZulu"));
    }

    #[test]
    fn an_unresolvable_row_code_is_kept_and_the_record_settles_the_tag() {
        let row = map_row(None, json!({"sentence": "mhoro", "locale": "sn"}));
        assert_eq!(row.language.as_deref(), Some("sn"));
        // Nothing in the row resolves, so the catalogue record supplies both.
        assert_eq!(row.language_tag.as_deref(), Some("sna"));
        assert_eq!(row.language_iso.as_deref(), Some("sna"));
    }

    #[test]
    fn a_column_outside_the_table_is_never_guessed_at() {
        let row = map_row(
            None,
            json!({"sentence": "mhoro", "spectrogram_blob": "xx", "tone_marks": "H L"}),
        );
        assert!(row.audio.is_none());
        assert_eq!(row.extra.len(), 2);
        assert!(row.extra.contains_key("spectrogram_blob"));
        assert!(row.extra.contains_key("tone_marks"));
    }

    #[test]
    fn milliseconds_are_converted_to_seconds() {
        let fm = FieldMap::bundled().unwrap();
        let map = fm.resolve(None, &cols(&["text", "audio", "duration_ms"]));
        let binding = map.binding("duration_s").expect("duration bound");
        assert_eq!(binding.column, "duration_ms");
        assert_eq!(binding.multiply, Some(0.001));

        let row = map_row(
            None,
            json!({"text": "ndeipi", "audio": "https://x/y.wav", "duration_ms": 2500}),
        );
        assert_eq!(row.duration_s, Some(2.5));
    }

    #[test]
    fn seconds_pass_through_unscaled() {
        let row = map_row(None, json!({"sentence": "hesi", "duration": 3.25}));
        assert_eq!(row.duration_s, Some(3.25));
    }

    #[test]
    fn a_row_column_overrides_the_catalogue_default() {
        let row = map_row(
            None,
            json!({"sentence": "hesi", "locale": "sn", "split": "test", "domain": "broadcast"}),
        );
        assert_eq!(row.language.as_deref(), Some("sn"));
        assert_eq!(row.split, "test");
        assert_eq!(row.domain.as_deref(), Some("broadcast"));
    }

    #[test]
    fn unmapped_columns_are_kept_and_dropped_columns_are_not() {
        let row = map_row(
            None,
            json!({
                "sentence": "mangwanani",
                "audio": {"src": "https://x/a.wav"},
                "up_votes": 3,
                "__index_level_0__": 11,
                "recording_device": "phone"
            }),
        );
        assert!(row.extra.contains_key("recording_device"));
        assert!(!row.extra.contains_key("up_votes"));
        assert!(!row.extra.contains_key("__index_level_0__"));
        assert!(!row.extra.contains_key("sentence"));
        assert_eq!(
            row.audio.as_ref().and_then(|a| a.url.as_deref()),
            Some("https://x/a.wav")
        );
    }

    #[test]
    fn sampling_rate_falls_back_to_the_audio_handle() {
        let row = map_row(
            None,
            json!({"text": "x", "audio": {"path": "a.wav", "sampling_rate": 48000}}),
        );
        assert_eq!(row.sampling_rate, Some(48_000));
    }

    #[test]
    fn null_values_leave_fields_empty() {
        let row = map_row(None, json!({"sentence": null, "audio": null, "gender": ""}));
        assert!(row.transcript.is_none());
        assert!(row.audio.is_none());
        assert!(row.gender.is_none());
    }

    #[test]
    fn an_override_column_that_is_absent_falls_back_to_aliases() {
        let fm = FieldMap::bundled().unwrap();
        // This fleurs mirror has no `transcription` column, only `text`.
        let map = fm.resolve(Some("google/fleurs"), &cols(&["text", "audio"]));
        assert_eq!(map.column("transcript"), Some("text"));
    }

    #[test]
    fn mapped_fields_are_reported_in_canonical_order() {
        let fm = FieldMap::bundled().unwrap();
        let map = fm.resolve(None, &cols(&["locale", "sentence", "audio"]));
        assert_eq!(map.mapped_fields(), vec!["transcript", "audio", "language"]);
    }
}
