//! `snippets.json` is what the website and the MCP `get_loader_snippet` tool
//! serve for Rust, so it has to match the shipped API rather than be invented.
//!
//! Two checks run here. The generated module below is produced by `build.rs`,
//! which substitutes real values into every Rust snippet, so the snippets are
//! compiled and type checked by `cargo test`. The assertions after it parse the
//! same snippets with `syn`, which turns a syntax error into a readable failure
//! naming the snippet rather than a wall of compiler output.

/// Every Rust snippet, placeholders filled in, compiled for real.
mod generated {
    include!(concat!(env!("OUT_DIR"), "/snippets_compiled.rs"));
}

use serde_json::Value;

/// The placeholder tokens a consumer may substitute. No snippet may use others.
const TOKENS: [(&str, &str); 7] = [
    ("{{LANGUAGE}}", "sna"),
    ("{{COUNTRY_ISO2}}", "ZW"),
    ("{{COUNTRY_NAME}}", "Zimbabwe"),
    ("{{DATASET_ID}}", "waxal-corpus-paper"),
    ("{{HF_REPO}}", "google/fleurs"),
    ("{{CONFIG}}", "sn_zw"),
    ("{{TASK}}", "ASR"),
];

/// The keys the consumers expect.
const KEYS: [&str; 7] = [
    "catalogue_filter",
    "stream_filter",
    "single_dataset",
    "language_page",
    "country_page",
    "dataset_page",
    "cli",
];

/// Read `snippets.json` from the crate root.
fn document() -> Value {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/snippets.json");
    let raw = std::fs::read_to_string(path).expect("snippets.json is shipped with the crate");
    serde_json::from_str(&raw).expect("snippets.json is valid json")
}

/// Fill every placeholder with a real value.
fn substitute(body: &str) -> String {
    let mut out = body.to_string();
    for (token, value) in TOKENS {
        out = out.replace(token, value);
    }
    out
}

#[test]
fn the_document_has_the_agreed_shape() {
    let doc = document();
    assert_eq!(doc["language"], "rust");
    assert_eq!(doc["install"], "cargo add ngano");
    let snippets = doc["snippets"].as_object().expect("snippets object");
    for key in KEYS {
        let body = snippets[key].as_str().expect("snippet is a string");
        assert!(!body.trim().is_empty(), "{key} is empty");
    }
    assert_eq!(snippets.len(), KEYS.len(), "unexpected extra snippets");
}

#[test]
fn only_the_agreed_placeholder_tokens_appear() {
    let doc = document();
    for (key, body) in doc["snippets"].as_object().unwrap() {
        let filled = substitute(body.as_str().unwrap());
        assert!(
            !filled.contains("{{"),
            "{key} uses a placeholder outside the agreed set: {filled}"
        );
    }
}

#[test]
fn every_rust_snippet_parses() {
    let doc = document();
    for (key, body) in doc["snippets"].as_object().unwrap() {
        if key == "cli" {
            continue;
        }
        let filled = substitute(body.as_str().unwrap());
        syn::parse_file(&filled)
            .unwrap_or_else(|e| panic!("snippet {key} does not parse as rust: {e}"));
    }
}

#[test]
fn every_rust_snippet_brings_its_own_imports() {
    let doc = document();
    for (key, body) in doc["snippets"].as_object().unwrap() {
        if key == "cli" {
            continue;
        }
        let body = body.as_str().unwrap();
        assert!(
            body.contains("use ngano::"),
            "{key} should show the use lines a reader needs"
        );
        if body.contains("try_next") {
            assert!(
                body.contains("use futures::TryStreamExt;"),
                "{key} calls try_next without importing the trait"
            );
        }
    }
}

#[test]
fn the_cli_snippet_uses_real_commands() {
    let doc = document();
    let cli = substitute(doc["snippets"]["cli"].as_str().unwrap());
    for line in cli.lines().filter(|l| l.starts_with("ngano ")) {
        let command = line.split_whitespace().nth(1).unwrap();
        assert!(
            ["search", "show", "countries", "languages", "stats", "load"].contains(&command),
            "unknown subcommand in the cli snippet: {command}"
        );
    }
    assert!(
        cli.contains("--features cli"),
        "the binary needs its feature"
    );
}

#[test]
fn the_snippets_call_the_api_that_ships() {
    // The generated module above is the real check: it compiles every snippet.
    // This keeps the intent visible if that module is ever emptied.
    let doc = document();
    let snippets = doc["snippets"].as_object().unwrap();
    assert!(snippets["single_dataset"]
        .as_str()
        .unwrap()
        .contains(".repo("));
    assert!(snippets["dataset_page"]
        .as_str()
        .unwrap()
        .contains(".dataset("));
    assert!(snippets["catalogue_filter"]
        .as_str()
        .unwrap()
        .contains("Catalogue::bundled"));
}
