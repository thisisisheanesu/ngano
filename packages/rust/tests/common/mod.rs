#![allow(dead_code)]

//! Shared fixtures for the integration tests.

use ngano::{Catalogue, Dataset, Row};
use serde_json::json;

/// Build a catalogue record with sensible defaults, overriding a few fields.
pub fn dataset(id: &str, repo: Option<&str>, hours: Option<f64>, unverified: bool) -> Dataset {
    serde_json::from_value(json!({
        "id": id,
        "name": format!("Fixture {id}"),
        "task": "ASR",
        "variety": "Indigenous",
        "languages": ["Shona"],
        "languages_clean": ["Shona"],
        "iso": ["sna"],
        "language_tags": ["sna"],
        "language_codes": ["sna"],
        "countries": ["Zimbabwe"],
        "country_codes": ["ZW"],
        "regions": ["Southern Africa"],
        "hours": hours.map(|h| h.to_string()),
        "hours_num": hours,
        "speakers": null,
        "recording_type": "studio",
        "quality": "Standard (16 kHz)",
        "labelled": "Transcribed",
        "domain": "Read speech",
        "licence": "CC-BY-4.0",
        "licence_class": "Attribution (CC-BY)",
        "commercial": "Yes",
        "access": "Open",
        "host": if repo.is_some() { "HuggingFace" } else { "Other" },
        "url": repo.map(|r| format!("https://huggingface.co/datasets/{r}")),
        "hf_repo": repo,
        "year": "2025",
        "notes": "Fixture record used by the test suite.",
        "unverified_size": unverified
    }))
    .expect("fixture dataset")
}

/// A catalogue holding only the given records.
pub fn catalogue(datasets: Vec<Dataset>) -> Catalogue {
    Catalogue::from_parts(datasets, Vec::new(), Vec::new())
}

/// A minimal canonical row, used to test interleaving without any HTTP.
pub fn row(dataset_id: &str, transcript: &str) -> Row {
    Row {
        audio: None,
        transcript: Some(transcript.to_string()),
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
        split: "train".to_string(),
        dataset_id: Some(dataset_id.to_string()),
        hf_repo: "org/repo".to_string(),
        licence: "CC-BY-4.0".to_string(),
        source_url: "https://example.org".to_string(),
        extra: Default::default(),
    }
}
