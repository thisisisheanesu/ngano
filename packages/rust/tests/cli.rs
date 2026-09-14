//! The `ngano` binary, run for real against the bundled snapshot. Offline.
//!
//! Built only with the `cli` feature, which is what provides the binary.

#![cfg(feature = "cli")]

use std::process::Command;

/// Run the binary and return its standard output, asserting it succeeded.
fn run(args: &[&str]) -> String {
    let out = Command::new(env!("CARGO_BIN_EXE_ngano"))
        .args(args)
        .output()
        .expect("the ngano binary runs");
    assert!(
        out.status.success(),
        "ngano {args:?} failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    String::from_utf8(out.stdout).expect("stdout is utf-8")
}

#[test]
fn languages_lists_tags_with_codes_and_names() {
    let out = run(&["languages"]);
    let first = out.lines().next().expect("at least one language");
    let fields: Vec<&str> = first.split_whitespace().collect();
    assert!(fields.len() >= 3);
    assert!(out.contains("eng-NG"), "regional varieties are listed");
    assert!(out.contains("sna"));
    assert!(out.contains("Shona"));
}

#[test]
fn languages_can_be_narrowed_by_tag_code_or_name() {
    let by_code = run(&["languages", "--language", "sna"]);
    let by_name = run(&["languages", "--language", "Shona"]);
    assert_eq!(by_code, by_name);
    assert!(by_code.starts_with("sna"));

    let plain = run(&["languages", "--language", "eng"]);
    let wide = run(&["languages", "--language", "eng", "--include-varieties"]);
    assert_eq!(plain.lines().filter(|l| l.starts_with("eng ")).count(), 1);
    assert!(wide.lines().count() > plain.lines().count());
    assert!(wide.contains("eng-NG"));

    assert!(run(&["languages", "--language", "Klingon"]).contains("No languages matched."));
}

#[test]
fn search_accepts_a_code_a_tag_or_a_name() {
    let by_code = run(&["search", "--language", "sna", "--limit", "200"]);
    let by_name = run(&["search", "--language", "Shona", "--limit", "200"]);
    assert_eq!(by_code, by_name);
    assert!(by_code.contains(" shown."));

    let plain = run(&["search", "--language", "eng", "--limit", "500"]);
    let wide = run(&[
        "search",
        "--language",
        "eng",
        "--include-varieties",
        "--limit",
        "500",
    ]);
    assert!(wide.lines().count() > plain.lines().count());
}

#[test]
fn search_reports_a_language_it_cannot_resolve() {
    let out = Command::new(env!("CARGO_BIN_EXE_ngano"))
        .args(["search", "--language", "Klingon"])
        .output()
        .expect("the ngano binary runs");
    assert!(out.status.success());
    assert!(String::from_utf8_lossy(&out.stdout).contains("No datasets matched."));
    assert!(String::from_utf8_lossy(&out.stderr).contains("no language matches Klingon"));
}

#[test]
fn show_displays_tags_and_codes() {
    let out = run(&["show", "waxal-corpus-paper"]);
    assert!(out.contains("tags          "));
    assert!(out.contains("iso 639-3     "));

    // A record that describes its coverage in prose has no tags to show, and
    // says why instead.
    let prose = run(&["show", "flores-200"]);
    assert!(!prose.contains("tags          "));
    assert!(prose.contains("languages note:"));
}

#[test]
fn languages_as_json_carries_the_tag_shape() {
    let out = run(&["--json", "languages", "--language", "eng-NG"]);
    let parsed: serde_json::Value = serde_json::from_str(&out).expect("json");
    let entry = &parsed.as_array().expect("array")[0];
    assert_eq!(entry["tag"], "eng-NG");
    assert_eq!(entry["iso639_3"], "eng");
    assert_eq!(entry["region"], "NG");
    assert_eq!(entry["slug"], "eng-ng");
}

#[test]
fn stats_counts_tags_and_codes() {
    let out = run(&["--json", "stats"]);
    let parsed: serde_json::Value = serde_json::from_str(&out).expect("json");
    let tags = parsed["languages"].as_u64().expect("languages");
    let codes = parsed["language_codes"].as_u64().expect("language_codes");
    assert!(codes < tags, "varieties collapse into their code");
}
