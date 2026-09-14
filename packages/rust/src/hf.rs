//! A thin client over the Hugging Face datasets-server.

use std::time::Duration;

use serde::Deserialize;
use serde_json::{Map, Value};

use crate::error::{NganoError, Result};
use crate::http::HttpClient;

/// The public datasets-server base URL.
pub const DEFAULT_HF_BASE: &str = "https://datasets-server.huggingface.co";

/// The server refuses `length` above this, so pages are capped here.
pub const MAX_PAGE_ROWS: usize = 100;

/// One `config`/`split` pair inside a dataset.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub(crate) struct SplitRef {
    /// Config name, for example `sn_zw`.
    pub config: String,
    /// Split name, for example `train`.
    pub split: String,
}

/// Body of `GET /splits`.
#[derive(Debug, Deserialize)]
struct SplitsResponse {
    #[serde(default)]
    splits: Vec<SplitRef>,
}

/// One column description in a `GET /rows` response.
#[derive(Debug, Deserialize)]
struct FeatureDef {
    name: String,
}

/// One row envelope in a `GET /rows` response.
#[derive(Debug, Deserialize)]
struct RowEnvelope {
    #[serde(default)]
    row: Map<String, Value>,
}

/// Body of `GET /rows`.
#[derive(Debug, Deserialize)]
struct RowsResponse {
    #[serde(default)]
    features: Vec<FeatureDef>,
    #[serde(default)]
    rows: Vec<RowEnvelope>,
    #[serde(default)]
    num_rows_total: Option<u64>,
}

/// One page of rows, already flattened.
#[derive(Debug)]
pub(crate) struct RowsPage {
    /// Column names declared by the server for this split.
    pub columns: Vec<String>,
    /// The row objects themselves.
    pub rows: Vec<Map<String, Value>>,
    /// Total rows in the split, when the server reports it.
    pub total: Option<u64>,
}

/// Body of `GET /info`.
#[derive(Debug, Deserialize)]
struct InfoResponse {
    #[serde(default)]
    dataset_info: Value,
}

/// Client for `/splits`, `/rows` and `/info`.
#[derive(Debug, Clone)]
pub(crate) struct HfClient {
    http: HttpClient,
    base: String,
}

impl HfClient {
    /// Build a client against `base`, authenticating with `token` when given.
    pub(crate) fn new(
        base: &str,
        token: Option<String>,
        max_retries: u32,
        backoff: Duration,
    ) -> Result<Self> {
        Ok(Self {
            http: HttpClient::new("datasets-server")?
                .with_token(token)
                .with_retries(max_retries, backoff),
            base: base.trim_end_matches('/').to_string(),
        })
    }

    /// The underlying client, reused for lazy audio fetches.
    pub(crate) fn http(&self) -> &HttpClient {
        &self.http
    }

    /// List every config and split of a dataset.
    pub(crate) async fn splits(&self, repo: &str) -> Result<Vec<SplitRef>> {
        let url = format!("{}/splits?dataset={}", self.base, encode(repo));
        let body: SplitsResponse = self.http.get_json(&url, Some(repo)).await?;
        if body.splits.is_empty() {
            return Err(NganoError::InvalidResponse {
                url,
                detail: format!("dataset {repo} reports no splits"),
            });
        }
        Ok(body.splits)
    }

    /// Fetch one page of rows. `length` is clamped to [`MAX_PAGE_ROWS`].
    pub(crate) async fn rows(
        &self,
        repo: &str,
        split: &SplitRef,
        offset: usize,
        length: usize,
    ) -> Result<RowsPage> {
        let length = length.clamp(1, MAX_PAGE_ROWS);
        let url = format!(
            "{}/rows?dataset={}&config={}&split={}&offset={}&length={}",
            self.base,
            encode(repo),
            encode(&split.config),
            encode(&split.split),
            offset,
            length
        );
        let body: RowsResponse = self.http.get_json(&url, Some(repo)).await?;
        let mut columns: Vec<String> = body.features.into_iter().map(|f| f.name).collect();
        if columns.is_empty() {
            if let Some(first) = body.rows.first() {
                columns = first.row.keys().cloned().collect();
            }
        }
        Ok(RowsPage {
            columns,
            rows: body.rows.into_iter().map(|r| r.row).collect(),
            total: body.num_rows_total,
        })
    }

    /// Column names taken from `GET /info`, used when a split's first page is
    /// empty and carries no feature list.
    pub(crate) async fn columns(&self, repo: &str, config: &str) -> Result<Vec<String>> {
        let url = format!(
            "{}/info?dataset={}&config={}",
            self.base,
            encode(repo),
            encode(config)
        );
        let body: InfoResponse = self.http.get_json(&url, Some(repo)).await?;
        let features = body
            .dataset_info
            .get("features")
            .and_then(Value::as_object)
            .map(|m| m.keys().cloned().collect())
            .unwrap_or_default();
        Ok(features)
    }
}

/// Percent-encode a query parameter value. Unreserved characters pass through.
fn encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 8);
    for byte in value.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            other => out.push_str(&format!("%{other:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_values_are_percent_encoded() {
        assert_eq!(encode("google/fleurs"), "google%2Ffleurs");
        assert_eq!(encode("sn_zw"), "sn_zw");
        assert_eq!(encode("a b"), "a%20b");
    }
}
