//! The single error type used across the crate.

use std::fmt;

/// Every fallible operation in `ngano` returns this error.
///
/// Network, decoding and catalogue problems all funnel into one enum so callers
/// can match on a single type.
///
/// ```
/// use ngano::NganoError;
///
/// let err = NganoError::Gated {
///     repo: "some-org/private-corpus".to_string(),
///     url: "https://huggingface.co/datasets/some-org/private-corpus".to_string(),
/// };
/// assert!(err.to_string().contains("some-org/private-corpus"));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum NganoError {
    /// The transport failed: DNS, TLS, connection or body error.
    #[error("http transport error: {0}")]
    Http(#[from] reqwest::Error),

    /// A response body could not be decoded into the expected shape.
    #[error("could not decode json: {0}")]
    Json(#[from] serde_json::Error),

    /// Reading or writing a local file failed.
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    /// The dataset is access-controlled on Hugging Face. Accept its terms, or
    /// request access, at `url` and pass a token with
    /// [`Loader::hf_token`](crate::Loader::hf_token).
    #[error("dataset {repo} is gated: accept its terms at {url}, then pass an HF token")]
    Gated {
        /// The Hugging Face repo id, for example `mozilla-foundation/common_voice_17_0`.
        repo: String,
        /// The dataset page where access is granted.
        url: String,
    },

    /// A server returned an error status that is not retryable.
    #[error("{source_name} returned {status}: {message}")]
    Api {
        /// Which service answered, for example `ngano api` or `datasets-server`.
        source_name: String,
        /// The HTTP status code.
        status: u16,
        /// The server message, or the raw body when it carried no message.
        message: String,
    },

    /// A resource does not exist.
    #[error("not found: {0}")]
    NotFound(String),

    /// Retries were exhausted against a server that kept failing.
    #[error("gave up after {attempts} attempts against {url}{}", .status.map(|s| format!(" (last status {s})")).unwrap_or_default())]
    RetryLimit {
        /// The URL that kept failing.
        url: String,
        /// How many attempts were made.
        attempts: u32,
        /// The last HTTP status seen, if the failures were HTTP rather than transport.
        status: Option<u16>,
    },

    /// A response parsed as JSON but did not contain what the protocol promises.
    #[error("unexpected response from {url}: {detail}")]
    InvalidResponse {
        /// The URL that produced the response.
        url: String,
        /// What was wrong with it.
        detail: String,
    },

    /// The loader was asked to stream but no catalogue entry matched, or none
    /// of the matches is hosted on Hugging Face.
    #[error("no streamable datasets matched the filter: {0}")]
    NoDatasets(String),

    /// An [`AudioRef`](crate::AudioRef) carries no inline bytes and no URL, so
    /// there is nothing to read.
    #[error("audio reference for {0} has neither bytes nor a url")]
    AudioUnavailable(String),

    /// A blocking helper could not start its runtime.
    #[error("could not start a tokio runtime: {0}")]
    Runtime(String),
}

impl NganoError {
    /// True when the failure is worth retrying: transport errors, `429`, and
    /// `5xx` responses.
    ///
    /// ```
    /// use ngano::NganoError;
    ///
    /// let err = NganoError::Api {
    ///     source_name: "datasets-server".into(),
    ///     status: 503,
    ///     message: "unavailable".into(),
    /// };
    /// assert!(err.is_retryable());
    /// ```
    pub fn is_retryable(&self) -> bool {
        match self {
            NganoError::Http(e) => !e.is_builder() && !e.is_decode(),
            NganoError::Api { status, .. } => is_retryable_status(*status),
            NganoError::RetryLimit { .. } => false,
            _ => false,
        }
    }

    /// The HTTP status behind this error, when there is one.
    pub fn status(&self) -> Option<u16> {
        match self {
            NganoError::Api { status, .. } => Some(*status),
            NganoError::RetryLimit { status, .. } => *status,
            NganoError::Gated { .. } => Some(401),
            NganoError::NotFound(_) => Some(404),
            NganoError::Http(e) => e.status().map(|s| s.as_u16()),
            _ => None,
        }
    }
}

/// `429` and any `5xx` are transient by convention.
pub(crate) fn is_retryable_status(status: u16) -> bool {
    status == 429 || (500..600).contains(&status)
}

/// A short alias for results produced by this crate.
pub type Result<T, E = NganoError> = std::result::Result<T, E>;

/// The shape of an error body returned by the ngano HTTP API.
#[derive(Debug, serde::Deserialize)]
pub(crate) struct ApiErrorBody {
    pub error: ApiErrorDetail,
}

/// The inner object of an ngano API error body.
#[derive(Debug, serde::Deserialize)]
pub(crate) struct ApiErrorDetail {
    #[serde(default)]
    pub code: String,
    #[serde(default)]
    pub message: String,
}

impl fmt::Display for ApiErrorDetail {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.code.is_empty() {
            write!(f, "{}", self.message)
        } else {
            write!(f, "{} ({})", self.message, self.code)
        }
    }
}
