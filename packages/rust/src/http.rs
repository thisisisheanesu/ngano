//! A small retrying JSON client shared by the catalogue and the loader.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use bytes::Bytes;
use serde::de::DeserializeOwned;

use crate::error::{is_retryable_status, ApiErrorBody, NganoError, Result};

/// Default number of attempts beyond the first.
pub(crate) const DEFAULT_MAX_RETRIES: u32 = 4;
/// Default first backoff step.
pub(crate) const DEFAULT_BACKOFF: Duration = Duration::from_millis(500);
/// Backoff is never allowed past this, whatever the server asks for.
const MAX_BACKOFF: Duration = Duration::from_secs(30);

/// A process-wide xorshift source, used only to jitter retry delays.
static SEED: AtomicU64 = AtomicU64::new(0);

/// Return a pseudo-random float in `[0, 1)`. Seeded lazily from the clock.
fn unit_random() -> f64 {
    let mut s = SEED.load(Ordering::Relaxed);
    if s == 0 {
        s = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0x9E37_79B9_7F4A_7C15)
            | 1;
    }
    s ^= s << 13;
    s ^= s >> 7;
    s ^= s << 17;
    SEED.store(s, Ordering::Relaxed);
    (s >> 11) as f64 / (1u64 << 53) as f64
}

/// Full-jitter exponential backoff: a uniform draw from `[0, base * 2^attempt]`.
pub(crate) fn backoff_delay(base: Duration, attempt: u32) -> Duration {
    let scaled = base.saturating_mul(1u32 << attempt.min(16));
    let capped = scaled.min(MAX_BACKOFF);
    capped.mul_f64(unit_random())
}

/// A configured HTTP client with retry behaviour and error translation.
#[derive(Debug, Clone)]
pub(crate) struct HttpClient {
    client: reqwest::Client,
    token: Option<String>,
    source_name: &'static str,
    max_retries: u32,
    backoff: Duration,
}

impl HttpClient {
    /// Build a client. `source_name` appears in [`NganoError::Api`] messages.
    pub(crate) fn new(source_name: &'static str) -> Result<Self> {
        let client = reqwest::Client::builder()
            .user_agent(concat!("ngano-rs/", env!("CARGO_PKG_VERSION")))
            .build()?;
        Ok(Self {
            client,
            token: None,
            source_name,
            max_retries: DEFAULT_MAX_RETRIES,
            backoff: DEFAULT_BACKOFF,
        })
    }

    /// Attach a Hugging Face bearer token.
    pub(crate) fn with_token(mut self, token: Option<String>) -> Self {
        self.token = token.filter(|t| !t.trim().is_empty());
        self
    }

    /// Override the retry budget.
    pub(crate) fn with_retries(mut self, max_retries: u32, backoff: Duration) -> Self {
        self.max_retries = max_retries;
        self.backoff = backoff;
        self
    }

    /// GET a URL and decode its JSON body, retrying transient failures.
    ///
    /// `repo` turns a `401`/`403` into [`NganoError::Gated`] naming that repo.
    pub(crate) async fn get_json<T: DeserializeOwned>(
        &self,
        url: &str,
        repo: Option<&str>,
    ) -> Result<T> {
        let body = self.get_bytes_inner(url, repo).await?;
        serde_json::from_slice(&body).map_err(|e| NganoError::InvalidResponse {
            url: url.to_string(),
            detail: e.to_string(),
        })
    }

    /// GET a URL and return the raw body, retrying transient failures.
    pub(crate) async fn get_bytes(&self, url: &str, repo: Option<&str>) -> Result<Bytes> {
        self.get_bytes_inner(url, repo).await
    }

    async fn get_bytes_inner(&self, url: &str, repo: Option<&str>) -> Result<Bytes> {
        let mut last_status = None;
        for attempt in 0..=self.max_retries {
            let mut req = self.client.get(url);
            if let Some(token) = &self.token {
                req = req.bearer_auth(token);
            }
            match req.send().await {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    if resp.status().is_success() {
                        return Ok(resp.bytes().await?);
                    }
                    let retry_after = parse_retry_after(&resp);
                    let text = resp.text().await.unwrap_or_default();
                    if is_retryable_status(status) && attempt < self.max_retries {
                        last_status = Some(status);
                        let wait = retry_after
                            .unwrap_or_else(|| backoff_delay(self.backoff, attempt))
                            .min(MAX_BACKOFF);
                        tokio::time::sleep(wait).await;
                        continue;
                    }
                    return Err(self.status_error(url, status, &text, repo));
                }
                Err(e) => {
                    if attempt < self.max_retries && !e.is_builder() && !e.is_decode() {
                        tokio::time::sleep(backoff_delay(self.backoff, attempt)).await;
                        continue;
                    }
                    return Err(NganoError::Http(e));
                }
            }
        }
        Err(NganoError::RetryLimit {
            url: url.to_string(),
            attempts: self.max_retries + 1,
            status: last_status,
        })
    }

    /// Translate a non-success status into the most specific error available.
    fn status_error(&self, url: &str, status: u16, body: &str, repo: Option<&str>) -> NganoError {
        if matches!(status, 401 | 403) {
            if let Some(repo) = repo {
                return NganoError::Gated {
                    repo: repo.to_string(),
                    url: format!("https://huggingface.co/datasets/{repo}"),
                };
            }
        }
        let message = extract_message(body).unwrap_or_else(|| {
            let trimmed = body.trim();
            if trimmed.is_empty() {
                url.to_string()
            } else {
                trimmed.chars().take(400).collect()
            }
        });
        if status == 404 {
            return NganoError::NotFound(format!("{url}: {message}"));
        }
        if is_retryable_status(status) {
            return NganoError::RetryLimit {
                url: url.to_string(),
                attempts: self.max_retries + 1,
                status: Some(status),
            };
        }
        NganoError::Api {
            source_name: self.source_name.to_string(),
            status,
            message,
        }
    }
}

/// Pull a human message out of either error body shape used by the two APIs:
/// `{"error":{"code":..,"message":..}}` and `{"error":"..."}`.
fn extract_message(body: &str) -> Option<String> {
    if let Ok(parsed) = serde_json::from_str::<ApiErrorBody>(body) {
        return Some(parsed.error.to_string());
    }
    let value: serde_json::Value = serde_json::from_str(body).ok()?;
    value
        .get("error")
        .and_then(|e| e.as_str())
        .map(str::to_string)
}

/// Honour a numeric `Retry-After` header, ignoring date forms.
fn parse_retry_after(resp: &reqwest::Response) -> Option<Duration> {
    let raw = resp.headers().get(reqwest::header::RETRY_AFTER)?;
    let secs: u64 = raw.to_str().ok()?.trim().parse().ok()?;
    Some(Duration::from_secs(secs))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_grows_and_stays_within_bounds() {
        let base = Duration::from_millis(100);
        for attempt in 0..8 {
            let ceiling = base.saturating_mul(1 << attempt).min(MAX_BACKOFF);
            for _ in 0..64 {
                let d = backoff_delay(base, attempt);
                assert!(d <= ceiling, "{d:?} exceeded {ceiling:?}");
            }
        }
    }

    #[test]
    fn backoff_is_jittered() {
        let base = Duration::from_millis(1000);
        let draws: Vec<Duration> = (0..32).map(|_| backoff_delay(base, 3)).collect();
        assert!(
            draws.windows(2).any(|w| w[0] != w[1]),
            "expected jitter, got a constant delay"
        );
    }

    #[test]
    fn backoff_is_capped() {
        assert!(backoff_delay(Duration::from_secs(10), 20) <= MAX_BACKOFF);
    }

    #[test]
    fn messages_come_out_of_both_error_shapes() {
        assert_eq!(
            extract_message(r#"{"error":{"code":"bad_request","message":"nope","status":400}}"#),
            Some("nope (bad_request)".to_string())
        );
        assert_eq!(
            extract_message(r#"{"error":"Dataset not found"}"#),
            Some("Dataset not found".to_string())
        );
        assert_eq!(extract_message("not json"), None);
    }
}
