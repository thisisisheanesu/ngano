//! Synchronous API, behind the `blocking` feature. Offline throughout.
#![cfg(feature = "blocking")]

mod common;

use std::time::Duration;

use ngano::{Catalogue, Filter, Loader, NganoError};
use serde_json::json;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// Start a mock server on its own thread, then hand back its base URL.
/// wiremock drives each server from a private runtime, so the blocking API can
/// talk to it without nesting runtimes.
fn mock_server() -> (tokio::runtime::Runtime, MockServer) {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("runtime");
    let server = runtime.block_on(MockServer::start());
    runtime.block_on(async {
        Mock::given(method("GET"))
            .and(path("/splits"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "splits": [{"dataset": "org/a", "config": "sn", "split": "train"}]
            })))
            .mount(&server)
            .await;
        Mock::given(method("GET"))
            .and(path("/rows"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "features": [
                    {"feature_idx": 0, "name": "sentence", "type": {"dtype": "string", "_type": "Value"}},
                    {"feature_idx": 1, "name": "duration_ms", "type": {"dtype": "int64", "_type": "Value"}}
                ],
                "rows": [
                    {"row_idx": 0, "row": {"sentence": "mhoro", "duration_ms": 1000}},
                    {"row_idx": 1, "row": {"sentence": "mangwanani", "duration_ms": 2000}}
                ],
                "num_rows_total": 2
            })))
            .mount(&server)
            .await;
    });
    (runtime, server)
}

#[test]
fn the_blocking_loader_yields_rows_as_an_iterator() {
    let (_runtime, server) = mock_server();
    let rows: Vec<_> = Loader::new()
        .catalogue(common::catalogue(vec![common::dataset(
            "ds-a",
            Some("org/a"),
            Some(4.0),
            false,
        )]))
        .api_base(server.uri())
        .retries(1, Duration::from_millis(1))
        .blocking()
        .expect("blocking loader")
        .rows()
        .expect("stream opens")
        .collect::<Result<Vec<_>, NganoError>>()
        .expect("rows");

    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].transcript.as_deref(), Some("mhoro"));
    assert_eq!(rows[0].duration_s, Some(1.0));
    assert_eq!(rows[1].duration_s, Some(2.0));
}

#[test]
fn the_blocking_loader_reports_an_empty_selection() {
    let err = Loader::new()
        .catalogue(common::catalogue(vec![common::dataset(
            "no-repo", None, None, false,
        )]))
        .filter(Filter::new().language("sna"))
        .blocking()
        .expect("blocking loader")
        .rows()
        .expect_err("nothing to stream");
    assert!(matches!(err, NganoError::NoDatasets(_)));
}

#[test]
fn the_blocking_catalogue_fetch_surfaces_transport_errors() {
    // Port 1 is never listening, so this exercises the runtime and the client
    // without reaching the network.
    let err = Catalogue::from_api_base_blocking("http://127.0.0.1:1/api/v1")
        .expect_err("connection refused");
    assert!(matches!(err, NganoError::Http(_)), "got {err:?}");
}
