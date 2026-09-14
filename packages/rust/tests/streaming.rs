//! HTTP behaviour of the loader, exercised against a local mock server.
//! Nothing here reaches the public internet.

mod common;

use std::time::Duration;

use futures::StreamExt;
use ngano::{Filter, Interleave, Loader, NganoError};
use serde_json::json;
use wiremock::matchers::{method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// Mount a `/splits` response listing one config and split.
async fn mount_splits(server: &MockServer, repo: &str, config: &str, splits: &[&str]) {
    let body = json!({
        "splits": splits
            .iter()
            .map(|s| json!({"dataset": repo, "config": config, "split": s}))
            .collect::<Vec<_>>()
    });
    Mock::given(method("GET"))
        .and(path("/splits"))
        .and(query_param("dataset", repo))
        .respond_with(ResponseTemplate::new(200).set_body_json(body))
        .mount(server)
        .await;
}

/// Build a `/rows` body with `rows` common-voice shaped records.
fn rows_body(offset: usize, count: usize, total: u64, audio_base: &str) -> serde_json::Value {
    let rows: Vec<serde_json::Value> = (0..count)
        .map(|i| {
            let idx = offset + i;
            json!({
                "row_idx": idx,
                "truncated_cells": [],
                "row": {
                    "client_id": format!("spk-{idx}"),
                    "audio": [{"src": format!("{audio_base}/clip{idx}.wav"), "type": "audio/wav"}],
                    "sentence": format!("utterance {idx}"),
                    "locale": "sn",
                    "duration_ms": 1500,
                    "up_votes": 2,
                    "recording_device": "phone"
                }
            })
        })
        .collect();
    json!({
        "features": [
            {"feature_idx": 0, "name": "client_id", "type": {"dtype": "string", "_type": "Value"}},
            {"feature_idx": 1, "name": "audio", "type": {"_type": "Audio"}},
            {"feature_idx": 2, "name": "sentence", "type": {"dtype": "string", "_type": "Value"}},
            {"feature_idx": 3, "name": "locale", "type": {"dtype": "string", "_type": "Value"}},
            {"feature_idx": 4, "name": "duration_ms", "type": {"dtype": "int64", "_type": "Value"}},
            {"feature_idx": 5, "name": "up_votes", "type": {"dtype": "int64", "_type": "Value"}},
            {"feature_idx": 6, "name": "recording_device", "type": {"dtype": "string", "_type": "Value"}}
        ],
        "rows": rows,
        "num_rows_total": total,
        "num_rows_per_page": 100,
        "partial": false
    })
}

/// A loader pointed at the mock server, streaming one fixture dataset.
fn loader(server: &MockServer, id: &str, repo: &str) -> Loader {
    Loader::new()
        .catalogue(common::catalogue(vec![common::dataset(
            id,
            Some(repo),
            Some(12.0),
            false,
        )]))
        .api_base(server.uri())
        .retries(3, Duration::from_millis(1))
}

/// Count the requests whose path matches.
async fn hits(server: &MockServer, want: &str) -> usize {
    server
        .received_requests()
        .await
        .unwrap_or_default()
        .iter()
        .filter(|r| r.url.path() == want)
        .count()
}

#[tokio::test]
async fn rows_paginate_transparently_and_map_onto_the_canonical_schema() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train"]).await;
    let base = server.uri();
    for (offset, count) in [(0usize, 2usize), (2, 2), (4, 1)] {
        Mock::given(method("GET"))
            .and(path("/rows"))
            .and(query_param("offset", offset.to_string()))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(rows_body(offset, count, 5, &base)),
            )
            .mount(&server)
            .await;
    }

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .split("train")
        .page_size(2)
        .stream()
        .await
        .expect("stream opens");

    let mut rows = Vec::new();
    while let Some(row) = stream.next().await {
        rows.push(row.expect("row"));
    }

    assert_eq!(rows.len(), 5);
    assert_eq!(hits(&server, "/rows").await, 3);

    let first = &rows[0];
    assert_eq!(first.transcript.as_deref(), Some("utterance 0"));
    assert_eq!(first.speaker_id.as_deref(), Some("spk-0"));
    // The source row states its own language, which is kept verbatim, while the
    // tag and the bare code come from the catalogue record.
    assert_eq!(first.language.as_deref(), Some("sn"));
    assert_eq!(first.language_iso.as_deref(), Some("sna"));
    assert_eq!(first.language_tag.as_deref(), Some("sna"));
    assert_eq!(first.duration_s, Some(1.5));
    assert_eq!(first.split, "train");
    assert_eq!(first.dataset_id.as_deref(), Some("cv-sn"));
    assert_eq!(first.hf_repo, "org/cv");
    assert_eq!(first.licence, "CC-BY-4.0");
    assert_eq!(first.country.as_deref(), Some("ZW"));
    assert_eq!(first.domain.as_deref(), Some("Read speech"));
    assert!(first.extra.contains_key("recording_device"));
    assert!(!first.extra.contains_key("up_votes"), "drop list applies");
    assert_eq!(rows[4].transcript.as_deref(), Some("utterance 4"));
}

#[tokio::test]
async fn audio_is_only_fetched_when_it_is_read() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train"]).await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 1, 1, &base)))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/clip0.wav"))
        .respond_with(ResponseTemplate::new(200).set_body_bytes(b"RIFFfake".to_vec()))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .stream()
        .await
        .expect("stream opens");
    let row = stream.next().await.expect("one row").expect("row");
    assert_eq!(hits(&server, "/clip0.wav").await, 0, "nothing fetched yet");

    let audio = row.audio.as_ref().expect("audio handle");
    assert!(audio.needs_fetch());
    let bytes = audio.read().await.expect("audio bytes");
    assert_eq!(&bytes[..], b"RIFFfake");
    assert_eq!(hits(&server, "/clip0.wav").await, 1);
}

#[tokio::test]
async fn page_length_is_capped_at_one_hundred() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train"]).await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .and(query_param("length", "100"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 1, 1, &base)))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .page_size(5_000)
        .stream()
        .await
        .expect("stream opens");
    assert!(stream.next().await.expect("row").is_ok());
}

#[tokio::test]
async fn a_gated_dataset_names_the_repo_and_its_access_page() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/splits"))
        .respond_with(ResponseTemplate::new(401).set_body_json(json!({"error": "Not authorized"})))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "gated", "secret-org/corpus")
        .stream()
        .await
        .expect("stream opens");
    let err = stream.next().await.expect("item").expect_err("gated");
    match err {
        NganoError::Gated { repo, url } => {
            assert_eq!(repo, "secret-org/corpus");
            assert_eq!(url, "https://huggingface.co/datasets/secret-org/corpus");
        }
        other => panic!("expected Gated, got {other:?}"),
    }
}

#[tokio::test]
async fn a_rate_limited_request_is_retried() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train"]).await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(429).insert_header("retry-after", "0"))
        .up_to_n_times(2)
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 1, 1, &base)))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .stream()
        .await
        .expect("stream opens");
    let row = stream
        .next()
        .await
        .expect("item")
        .expect("row after retries");
    assert_eq!(row.transcript.as_deref(), Some("utterance 0"));
    assert_eq!(hits(&server, "/rows").await, 3);
}

#[tokio::test]
async fn repeated_server_errors_give_up_with_a_retry_limit() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train"]).await;
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(503))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .stream()
        .await
        .expect("stream opens");
    let err = stream.next().await.expect("item").expect_err("gives up");
    match err {
        NganoError::RetryLimit {
            attempts, status, ..
        } => {
            assert_eq!(attempts, 4);
            assert_eq!(status, Some(503));
        }
        other => panic!("expected RetryLimit, got {other:?}"),
    }
    assert_eq!(hits(&server, "/rows").await, 4);
}

#[tokio::test]
async fn dropping_the_stream_stops_the_downloads() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train"]).await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 2, 10_000, &base)))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .page_size(2)
        .stream()
        .await
        .expect("stream opens");
    let _first = stream.next().await.expect("item").expect("row");
    drop(stream);

    assert_eq!(
        hits(&server, "/rows").await,
        1,
        "only the page in hand should have been fetched"
    );
}

#[tokio::test]
async fn the_limit_stops_paging() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train"]).await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 2, 10_000, &base)))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .page_size(2)
        .limit(Some(2))
        .stream()
        .await
        .expect("stream opens");
    let mut seen = 0;
    while stream.next().await.is_some() {
        seen += 1;
    }
    assert_eq!(seen, 2);
    assert_eq!(hits(&server, "/rows").await, 1);
}

#[tokio::test]
async fn several_splits_are_streamed_one_after_another() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train", "test"]).await;
    let base = server.uri();
    for split in ["train", "test"] {
        Mock::given(method("GET"))
            .and(path("/rows"))
            .and(query_param("split", split))
            .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 2, 2, &base)))
            .mount(&server)
            .await;
    }

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .stream()
        .await
        .expect("stream opens");
    let mut splits = Vec::new();
    while let Some(row) = stream.next().await {
        splits.push(row.expect("row").split);
    }
    assert_eq!(splits, ["train", "train", "test", "test"]);
}

#[tokio::test]
async fn asking_for_one_split_ignores_the_others() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train", "test"]).await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .and(query_param("split", "test"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 1, 1, &base)))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "cv-sn", "org/cv")
        .split("test")
        .stream()
        .await
        .expect("stream opens");
    let row = stream.next().await.expect("item").expect("row");
    assert_eq!(row.split, "test");
    assert!(stream.next().await.is_none());
}

#[tokio::test]
async fn two_datasets_alternate_under_round_robin() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/a", "sn", &["train"]).await;
    mount_splits(&server, "org/b", "sn", &["train"]).await;
    let base = server.uri();
    for repo in ["org/a", "org/b"] {
        Mock::given(method("GET"))
            .and(path("/rows"))
            .and(query_param("dataset", repo))
            .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 3, 3, &base)))
            .mount(&server)
            .await;
    }

    let catalogue = common::catalogue(vec![
        common::dataset("ds-a", Some("org/a"), Some(10.0), false),
        common::dataset("ds-b", Some("org/b"), Some(10.0), false),
    ]);
    let mut stream = Loader::new()
        .catalogue(catalogue)
        .api_base(server.uri())
        .retries(1, Duration::from_millis(1))
        .interleave(Interleave::RoundRobin)
        .stream()
        .await
        .expect("stream opens");

    let mut ids = Vec::new();
    while let Some(row) = stream.next().await {
        ids.push(row.expect("row").dataset_id.unwrap_or_default());
    }
    assert_eq!(ids, ["ds-a", "ds-b", "ds-a", "ds-b", "ds-a", "ds-b"]);
}

#[tokio::test]
async fn an_empty_selection_is_reported_rather_than_streamed() {
    let server = MockServer::start().await;
    let err = Loader::new()
        .catalogue(common::catalogue(vec![common::dataset(
            "no-repo", None, None, false,
        )]))
        .api_base(server.uri())
        .filter(Filter::new().language("sna"))
        .stream()
        .await
        .expect_err("nothing to stream");
    assert!(matches!(err, NganoError::NoDatasets(_)));
}

#[tokio::test]
async fn an_unknown_schema_degrades_to_none_instead_of_failing() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/odd", "default", &["train"]).await;
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "features": [
                {"feature_idx": 0, "name": "tone_marks", "type": {"dtype": "string", "_type": "Value"}},
                {"feature_idx": 1, "name": "spectrogram_blob", "type": {"dtype": "string", "_type": "Value"}}
            ],
            "rows": [{"row_idx": 0, "row": {"tone_marks": "H L", "spectrogram_blob": "xx"}}],
            "num_rows_total": 1
        })))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "odd", "org/odd")
        .stream()
        .await
        .expect("stream opens");
    let row = stream.next().await.expect("item").expect("row");
    assert!(row.transcript.is_none());
    assert!(row.audio.is_none());
    assert_eq!(row.extra.len(), 2);
    assert_eq!(row.dataset_id.as_deref(), Some("odd"));
}

#[tokio::test]
async fn a_column_named_wav_path_is_claimed_by_the_alias_table() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/odd", "default", &["train"]).await;
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "features": [
                {"feature_idx": 0, "name": "Text", "type": {"dtype": "string", "_type": "Value"}},
                {"feature_idx": 1, "name": "WAV_PATH", "type": {"dtype": "string", "_type": "Value"}}
            ],
            "rows": [{"row_idx": 0, "row": {"Text": "mhoro", "WAV_PATH": "clips/a.wav"}}],
            "num_rows_total": 1
        })))
        .mount(&server)
        .await;

    let mut stream = loader(&server, "odd", "org/odd")
        .stream()
        .await
        .expect("stream opens");
    let row = stream.next().await.expect("item").expect("row");
    assert_eq!(row.transcript.as_deref(), Some("mhoro"));
    assert_eq!(
        row.audio.as_ref().and_then(|a| a.path.as_deref()),
        Some("clips/a.wav")
    );
    assert!(row.extra.is_empty());
}

#[tokio::test]
async fn a_repo_outside_the_catalogue_streams_with_no_dataset_id() {
    let server = MockServer::start().await;
    mount_splits(&server, "someone/brand-new", "sw_ke", &["train"]).await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 2, 2, &base)))
        .mount(&server)
        .await;

    let mut stream = Loader::new()
        .catalogue(common::catalogue(vec![common::dataset(
            "unrelated",
            Some("org/other"),
            Some(3.0),
            false,
        )]))
        .api_base(server.uri())
        .retries(1, Duration::from_millis(1))
        .repo("someone/brand-new")
        .config("sw_ke")
        .stream()
        .await
        .expect("stream opens");

    let row = stream.next().await.expect("item").expect("row");
    assert_eq!(row.dataset_id, None);
    assert_eq!(row.hf_repo, "someone/brand-new");
    assert_eq!(row.licence, "Unstated");
    assert_eq!(
        row.source_url,
        "https://huggingface.co/datasets/someone/brand-new"
    );
    assert_eq!(row.transcript.as_deref(), Some("utterance 0"));
    // No catalogue record, so no country or domain fallback.
    assert_eq!(row.country, None);
    assert_eq!(row.domain, None);
    // The named repo replaces the filter, so the other dataset is not streamed.
    assert_eq!(stream.datasets(), 1);
}

#[tokio::test]
async fn a_repo_the_catalogue_lists_keeps_its_record() {
    let server = MockServer::start().await;
    mount_splits(&server, "org/cv", "sn", &["train"]).await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 1, 1, &base)))
        .mount(&server)
        .await;

    let mut stream = Loader::new()
        .catalogue(common::catalogue(vec![common::dataset(
            "cv-sn",
            Some("org/cv"),
            Some(12.0),
            false,
        )]))
        .api_base(server.uri())
        .retries(1, Duration::from_millis(1))
        .repo("ORG/CV")
        .stream()
        .await
        .expect("stream opens");

    let row = stream.next().await.expect("item").expect("row");
    assert_eq!(row.dataset_id.as_deref(), Some("cv-sn"));
    assert_eq!(row.licence, "CC-BY-4.0");
    assert_eq!(row.country.as_deref(), Some("ZW"));
}

#[tokio::test]
async fn a_config_narrows_the_splits_that_are_read() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/splits"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "splits": [
                {"dataset": "org/multi", "config": "sn_zw", "split": "train"},
                {"dataset": "org/multi", "config": "sw_ke", "split": "train"}
            ]
        })))
        .mount(&server)
        .await;
    let base = server.uri();
    Mock::given(method("GET"))
        .and(path("/rows"))
        .and(query_param("config", "sw_ke"))
        .respond_with(ResponseTemplate::new(200).set_body_json(rows_body(0, 1, 1, &base)))
        .mount(&server)
        .await;

    let mut stream = Loader::new()
        .api_base(server.uri())
        .retries(1, Duration::from_millis(1))
        .repo("org/multi")
        .config("sw_ke")
        .stream()
        .await
        .expect("stream opens");

    assert!(stream.next().await.expect("item").is_ok());
    assert!(stream.next().await.is_none());
    assert_eq!(hits(&server, "/rows").await, 1);
}
