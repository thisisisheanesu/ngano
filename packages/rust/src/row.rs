//! The canonical unified row and its lazy audio handle.

use std::collections::BTreeMap;
use std::sync::Arc;

use bytes::Bytes;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::catalogue::Inner as CatalogueInner;
use crate::error::{NganoError, Result};
use crate::http::HttpClient;

/// A lazy handle on one audio clip.
///
/// Nothing is downloaded until [`AudioRef::read`] is called. Some sources inline
/// the bytes in the row, in which case `read` returns them without any request.
///
/// ```
/// use ngano::AudioRef;
///
/// let a = AudioRef::from_url("https://example.org/clip.wav").with_sampling_rate(16_000);
/// assert_eq!(a.sampling_rate, Some(16_000));
/// assert!(a.bytes().is_none()); // nothing fetched yet
/// ```
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AudioRef {
    /// Remote URL for the clip, when the source exposes one.
    pub url: Option<String>,
    /// Path of the clip inside the dataset archive, when the source gives one.
    pub path: Option<String>,
    /// Sample rate in Hz, when the source states it.
    pub sampling_rate: Option<u32>,
    /// Bytes already present in the row. Not serialised.
    #[serde(skip)]
    bytes: Option<Bytes>,
    /// The client used by [`AudioRef::read`]. Not serialised.
    #[serde(skip)]
    fetcher: Option<HttpClient>,
    /// The repo this clip belongs to, used to report gated access.
    #[serde(skip)]
    repo: Option<String>,
}

impl PartialEq for AudioRef {
    fn eq(&self, other: &Self) -> bool {
        self.url == other.url
            && self.path == other.path
            && self.sampling_rate == other.sampling_rate
            && self.bytes == other.bytes
    }
}

impl AudioRef {
    /// A handle pointing at a remote URL.
    pub fn from_url(url: impl Into<String>) -> Self {
        Self {
            url: Some(url.into()),
            ..Self::default()
        }
    }

    /// A handle wrapping bytes you already hold.
    pub fn from_bytes(bytes: impl Into<Bytes>) -> Self {
        Self {
            bytes: Some(bytes.into()),
            ..Self::default()
        }
    }

    /// Set the sample rate.
    #[must_use]
    pub fn with_sampling_rate(mut self, hz: u32) -> Self {
        self.sampling_rate = Some(hz);
        self
    }

    /// Bytes already available without any network call.
    pub fn bytes(&self) -> Option<&Bytes> {
        self.bytes.as_ref()
    }

    /// True when reading would have to go to the network.
    pub fn needs_fetch(&self) -> bool {
        self.bytes.is_none() && self.url.is_some()
    }

    /// Read the clip, downloading it only if the bytes are not already present.
    ///
    /// Errors with [`NganoError::AudioUnavailable`] when the handle has neither
    /// bytes nor a URL, which happens when a dataset only publishes archive
    /// paths.
    ///
    /// ```no_run
    /// # async fn run(a: &ngano::AudioRef) -> Result<(), ngano::NganoError> {
    /// let bytes = a.read().await?;
    /// println!("{} bytes", bytes.len());
    /// # Ok(()) }
    /// ```
    pub async fn read(&self) -> Result<Bytes> {
        if let Some(b) = &self.bytes {
            return Ok(b.clone());
        }
        let Some(url) = &self.url else {
            return Err(NganoError::AudioUnavailable(
                self.path.clone().unwrap_or_else(|| "<unknown>".to_string()),
            ));
        };
        let client = match &self.fetcher {
            Some(c) => c.clone(),
            None => HttpClient::new("huggingface")?,
        };
        client.get_bytes(url, self.repo.as_deref()).await
    }

    /// Blocking counterpart of [`AudioRef::read`].
    ///
    /// Available with the `blocking` feature. It starts a private current-thread
    /// runtime, so it must not be called from inside an async runtime.
    #[cfg(feature = "blocking")]
    #[cfg_attr(docsrs, doc(cfg(feature = "blocking")))]
    pub fn read_blocking(&self) -> Result<Bytes> {
        crate::blocking::block_on(self.read())
    }

    /// Attach the client and repo used for lazy reads.
    pub(crate) fn with_fetcher(mut self, client: HttpClient, repo: &str) -> Self {
        self.fetcher = Some(client);
        self.repo = Some(repo.to_string());
        self
    }

    /// Build a handle from whatever shape the source put in the audio column.
    ///
    /// Understands a bare string, `{"src": url}` as used by the datasets-server,
    /// `{"path": .., "bytes": .., "sampling_rate": ..}` as used by the `datasets`
    /// library, and a list containing any of those.
    pub(crate) fn from_value(value: &Value) -> Option<Self> {
        match value {
            Value::Null => None,
            Value::String(s) if s.is_empty() => None,
            Value::String(s) => Some(if is_url(s) {
                Self::from_url(s.clone())
            } else {
                Self {
                    path: Some(s.clone()),
                    ..Self::default()
                }
            }),
            Value::Array(items) => items.iter().find_map(Self::from_value),
            Value::Object(map) => {
                let mut out = Self::default();
                for key in ["src", "url", "audio_url"] {
                    if let Some(s) = map.get(key).and_then(Value::as_str) {
                        out.url = Some(s.to_string());
                        break;
                    }
                }
                if let Some(s) = map.get("path").and_then(Value::as_str) {
                    if out.url.is_none() && is_url(s) {
                        out.url = Some(s.to_string());
                    } else {
                        out.path = Some(s.to_string());
                    }
                }
                if let Some(b) = map.get("bytes") {
                    if let Some(s) = b.as_str() {
                        out.bytes = Some(Bytes::from(s.as_bytes().to_vec()));
                    } else if let Some(arr) = b.as_array() {
                        let raw: Vec<u8> = arr
                            .iter()
                            .filter_map(|v| v.as_u64())
                            .map(|v| v as u8)
                            .collect();
                        if !raw.is_empty() {
                            out.bytes = Some(Bytes::from(raw));
                        }
                    }
                }
                out.sampling_rate = map
                    .get("sampling_rate")
                    .or_else(|| map.get("sample_rate"))
                    .and_then(as_u32);
                if out.url.is_none() && out.path.is_none() && out.bytes.is_none() {
                    None
                } else {
                    Some(out)
                }
            }
            _ => None,
        }
    }
}

/// True when a string looks like an absolute HTTP URL.
fn is_url(s: &str) -> bool {
    s.starts_with("http://") || s.starts_with("https://")
}

/// Coerce a JSON scalar to `u32`.
pub(crate) fn as_u32(v: &Value) -> Option<u32> {
    match v {
        Value::Number(n) => n
            .as_u64()
            .map(|x| x as u32)
            .or_else(|| n.as_f64().map(|x| x.round() as u32)),
        Value::String(s) => s.trim().parse::<f64>().ok().map(|x| x.round() as u32),
        _ => None,
    }
}

/// Coerce a JSON scalar to `f64`.
pub(crate) fn as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        _ => None,
    }
}

/// Coerce a JSON scalar to a non-empty string.
pub(crate) fn as_text(v: &Value) -> Option<String> {
    match v {
        Value::String(s) if s.trim().is_empty() => None,
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

/// One utterance in the canonical schema shared by the Python, JavaScript and
/// Rust SDKs.
///
/// Fields the source does not provide are `None`. An unrecognised schema is
/// never an error: the row still carries its dataset provenance, and every
/// unmapped column survives in [`Row::extra`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Row {
    /// Lazy audio handle. Nothing is fetched until you call
    /// [`AudioRef::read`].
    pub audio: Option<AudioRef>,
    /// Reference text for the utterance.
    pub transcript: Option<String>,
    /// Language as the source labels it, falling back to the canonical name of
    /// the dataset's language when the source row says nothing.
    pub language: Option<String>,
    /// The bare ISO 639-3 code for the row. It comes from the source row when
    /// the source states one, verbatim, and otherwise from the catalogue record
    /// of the dataset, which carries canonical codes.
    pub language_iso: Option<String>,
    /// The canonical BCP 47 tag for the row, for example `sna` or `eng-NG`.
    /// A tag the source states itself wins; failing that the row's own code
    /// settles it, then the row's own language, each when it resolves to
    /// exactly one tag; failing that the catalogue record does, when it names
    /// exactly one language. `None`
    /// when nothing settles it, such as a multilingual dataset whose rows say
    /// nothing about their own language.
    pub language_tag: Option<String>,
    /// ISO 3166-1 alpha-2 country code, from the row or the catalogue entry.
    /// A country label that cannot be resolved is passed through unchanged.
    pub country: Option<String>,
    /// Speaker identifier, stable within the dataset.
    pub speaker_id: Option<String>,
    /// Speaker gender as stated by the source. Never inferred.
    pub gender: Option<String>,
    /// Speaker age or age band as stated by the source. Never inferred.
    pub age: Option<String>,
    /// Utterance duration in seconds.
    pub duration_s: Option<f64>,
    /// Sample rate in Hz.
    pub sampling_rate: Option<u32>,
    /// Recording domain, from the row or the catalogue entry.
    pub domain: Option<String>,
    /// Source split name, for example `train`.
    pub split: String,
    /// ngano catalogue id of the dataset this row came from. `None` when the
    /// rows were requested by Hugging Face repo id and that repo is not in the
    /// catalogue.
    pub dataset_id: Option<String>,
    /// Hugging Face repo id.
    pub hf_repo: String,
    /// Licence string from the catalogue.
    pub licence: String,
    /// Canonical URL for the dataset.
    pub source_url: String,
    /// Every column that was not mapped and not dropped, verbatim.
    pub extra: BTreeMap<String, Value>,
}

/// Per-dataset constants and fallbacks applied while mapping rows.
#[derive(Debug, Clone)]
pub(crate) struct RowContext {
    pub dataset_id: Option<String>,
    pub hf_repo: String,
    pub licence: String,
    pub source_url: String,
    pub split: String,
    pub default_language: Option<String>,
    pub default_language_iso: Option<String>,
    pub default_language_tag: Option<String>,
    pub default_country: Option<String>,
    pub default_domain: Option<String>,
    pub catalogue: Option<Arc<CatalogueInner>>,
    pub fetcher: Option<HttpClient>,
}

impl RowContext {
    /// A skeleton row carrying only provenance, before column mapping.
    pub(crate) fn blank_row(&self) -> Row {
        Row {
            audio: None,
            transcript: None,
            language: None,
            language_iso: None,
            language_tag: None,
            country: None,
            speaker_id: None,
            gender: None,
            age: None,
            duration_s: None,
            sampling_rate: None,
            domain: None,
            split: self.split.clone(),
            dataset_id: self.dataset_id.clone(),
            hf_repo: self.hf_repo.clone(),
            licence: self.licence.clone(),
            source_url: self.source_url.clone(),
            extra: BTreeMap::new(),
        }
    }

    /// Apply catalogue-level fallbacks to fields the row did not supply.
    pub(crate) fn fill_defaults(&self, row: &mut Row) {
        if row.language.is_none() {
            row.language.clone_from(&self.default_language);
        }
        self.settle_language(row);
        if row.country.is_none() {
            row.country.clone_from(&self.default_country);
        }
        if row.domain.is_none() {
            row.domain.clone_from(&self.default_domain);
        }
        if let (Some(audio), None) = (&row.audio, row.sampling_rate) {
            row.sampling_rate = audio.sampling_rate;
        }
    }

    /// Settle the language fields of a row, with the rule the Python and
    /// JavaScript SDKs use too.
    ///
    /// The tag is taken from the first of these that yields one:
    ///
    /// 1. a `language_tag` column the source states itself,
    /// 2. the row's own code column, when it resolves to exactly one tag,
    /// 3. the row's own language column, on the same terms,
    /// 4. the catalogue record, when that record names exactly one language.
    ///
    /// The code comes before the language because a code is unambiguous where a
    /// name is not, so when the two disagree the code is the better evidence
    /// about what the row is. Python and JavaScript resolve in this same order.
    ///
    /// A stated value that the registry does not recognise is kept verbatim
    /// rather than dropped or guessed at.
    ///
    /// `language_iso` is then the bare ISO 639-3 code of that tag, or the code
    /// the row states itself when nothing resolved, or the record's single bare
    /// code. `language` keeps whatever the source said, falling back to the
    /// record's canonical name.
    fn settle_language(&self, row: &mut Row) {
        let registry = crate::language::LanguageRegistry::shared();
        let resolve_one = |value: &str| -> Option<String> {
            match registry.resolve(value, false).as_slice() {
                [one] => Some(one.clone()),
                _ => None,
            }
        };

        let tag = match row.language_tag.take() {
            // A stated tag wins, whether or not the registry knows it.
            Some(stated) => resolve_one(&stated).or(Some(stated)),
            // The code is tried before the name: a code is unambiguous where a
            // name is not, so when the two disagree the code is the better
            // evidence about what this row actually is.
            None => row
                .language_iso
                .as_deref()
                .and_then(resolve_one)
                .or_else(|| row.language.as_deref().and_then(resolve_one))
                .or_else(|| self.default_language_tag.clone()),
        };
        row.language_tag.clone_from(&tag);

        if let Some(code) = tag
            .as_deref()
            .and_then(|t| registry.get(t))
            .map(|c| c.iso639_3.clone())
        {
            row.language_iso = Some(code);
        } else if row.language_iso.is_none() {
            row.language_iso.clone_from(&self.default_language_iso);
        }
    }

    /// Normalise a country label seen in a row.
    pub(crate) fn normalise_country(&self, raw: &str) -> String {
        self.catalogue
            .as_ref()
            .and_then(|c| c.resolve_country(raw))
            .unwrap_or_else(|| raw.trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn audio_understands_the_datasets_server_shape() {
        let a = AudioRef::from_value(&json!({"src": "https://x/y.wav", "type": "audio/wav"}))
            .expect("handle");
        assert_eq!(a.url.as_deref(), Some("https://x/y.wav"));
        assert!(a.needs_fetch());
    }

    #[test]
    fn audio_understands_path_bytes_and_rate() {
        let a = AudioRef::from_value(&json!({
            "path": "clips/one.mp3",
            "bytes": [1, 2, 3],
            "sampling_rate": 48000
        }))
        .expect("handle");
        assert_eq!(a.path.as_deref(), Some("clips/one.mp3"));
        assert_eq!(a.sampling_rate, Some(48_000));
        assert_eq!(a.bytes().map(|b| b.len()), Some(3));
        assert!(!a.needs_fetch());
    }

    #[test]
    fn audio_unwraps_lists_and_plain_strings() {
        let a = AudioRef::from_value(&json!(["clips/one.wav"])).expect("handle");
        assert_eq!(a.path.as_deref(), Some("clips/one.wav"));
        let b = AudioRef::from_value(&json!("https://x/y.wav")).expect("handle");
        assert_eq!(b.url.as_deref(), Some("https://x/y.wav"));
        assert!(AudioRef::from_value(&json!(null)).is_none());
        assert!(AudioRef::from_value(&json!("")).is_none());
    }
}
