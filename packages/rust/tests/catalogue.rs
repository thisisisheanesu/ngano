//! Catalogue loading, filtering and aggregates, entirely offline.

mod common;

use ngano::{Catalogue, Filter};

#[test]
fn the_bundled_snapshot_loads_without_network() {
    let cat = Catalogue::bundled().expect("bundled catalogue");
    assert!(cat.len() >= 600);
    assert!(!cat.is_empty());
    assert_eq!(cat.countries().len(), 58);
    assert!(cat.languages().len() >= 300);
}

#[test]
fn filters_combine_as_or_within_and_and_across() {
    let cat = Catalogue::bundled().unwrap();

    let shona = cat.datasets(&Filter::new().language("sna"));
    let zulu = cat.datasets(&Filter::new().language("zul"));
    let both = cat.datasets(&Filter::new().language("sna").language("zul"));
    assert!(both.len() >= shona.len().max(zulu.len()));

    let shona_asr = cat.datasets(&Filter::new().language("sna").task("ASR"));
    assert!(shona_asr.len() <= shona.len());
    assert!(shona_asr.iter().all(|d| d.task == "ASR"));
}

#[test]
fn language_matching_ignores_case() {
    let cat = Catalogue::bundled().unwrap();
    let lower = cat.datasets(&Filter::new().language("shona"));
    let title = cat.datasets(&Filter::new().language("Shona"));
    let tag = cat.datasets(&Filter::new().language("SNA"));
    assert_eq!(lower.len(), title.len());
    assert_eq!(lower.len(), tag.len());
    assert!(!title.is_empty());
}

#[test]
fn commercial_filter_splits_the_catalogue_cleanly() {
    let cat = Catalogue::bundled().unwrap();
    let yes = cat.datasets(&Filter::new().commercial(true));
    let no = cat.datasets(&Filter::new().commercial(false));
    assert_eq!(yes.len() + no.len(), cat.len());
    assert!(yes.iter().all(|d| d.commercial.starts_with("Yes")));
    assert!(no.iter().all(|d| !d.commercial.starts_with("Yes")));
}

#[test]
fn country_filter_accepts_codes_and_names() {
    let cat = Catalogue::bundled().unwrap();
    let by_code = cat.datasets(&Filter::new().country("ZW"));
    let by_name = cat.datasets(&Filter::new().country("Zimbabwe"));
    assert!(!by_code.is_empty());
    assert_eq!(by_code.len(), by_name.len());
}

#[test]
fn hours_bounds_exclude_unverified_records() {
    let cat = Catalogue::bundled().unwrap();
    let big = cat.datasets(&Filter::new().min_hours(20_000.0));
    assert!(
        big.iter().all(|d| !d.unverified_size),
        "unverified sizes must never satisfy an hours bound"
    );
}

#[test]
fn hf_only_keeps_streamable_records() {
    let cat = Catalogue::bundled().unwrap();
    let hf = cat.datasets(&Filter::new().hf_only(true));
    assert!(!hf.is_empty());
    assert!(hf.iter().all(|d| d.is_streamable()));
}

#[test]
fn get_is_case_insensitive_and_require_reports_missing_ids() {
    let cat = Catalogue::bundled().unwrap();
    let id = cat.all()[0].id.clone();
    assert!(cat.get(&id.to_uppercase()).is_some());
    assert!(cat.get("definitely-not-a-dataset").is_none());
    assert!(cat.require("definitely-not-a-dataset").is_err());
}

#[test]
fn search_looks_across_names_notes_and_places() {
    let cat = Catalogue::bundled().unwrap();
    let hits = cat.search("parliament");
    for d in &hits {
        let hay = format!("{} {} {}", d.name, d.notes, d.domain).to_lowercase();
        assert!(hay.contains("parliament"));
    }
    assert!(cat.search("zzzzz-no-such-thing").is_empty());
}

#[test]
fn stats_exclude_unverified_hours() {
    let cat = Catalogue::bundled().unwrap();
    let stats = cat.stats();
    assert_eq!(stats.datasets, cat.len());
    assert!(stats.unverified_datasets > 0);
    let naive: f64 = cat.all().iter().filter_map(|d| d.hours_num).sum();
    let counted: f64 = cat.all().iter().filter_map(|d| d.countable_hours()).sum();
    assert!((stats.hours - counted).abs() < 1e-6);
    assert!(stats.hours < naive);
    assert!(stats.by_task.values().sum::<usize>() == cat.len());
}

#[test]
fn stats_can_be_scoped_to_a_selection() {
    let cat = Catalogue::bundled().unwrap();
    let picks = cat.datasets(&Filter::new().task("TTS"));
    let scoped = cat.stats_for(picks.iter().copied());
    assert_eq!(scoped.datasets, picks.len());
    assert!(scoped.datasets < cat.len());
}

#[test]
fn a_catalogue_can_be_built_from_parts() {
    let cat = common::catalogue(vec![
        common::dataset("a", Some("org/a"), Some(10.0), false),
        common::dataset("b", None, Some(5.0), false),
    ]);
    assert_eq!(cat.len(), 2);
    assert_eq!(cat.datasets(&Filter::new().hf_only(true)).len(), 1);
    assert_eq!(cat.stats().hours, 15.0);
}

#[test]
fn country_codes_resolve_from_names_and_codes() {
    let cat = Catalogue::bundled().unwrap();
    assert_eq!(cat.country_code("Zimbabwe").as_deref(), Some("ZW"));
    assert_eq!(cat.country_code("zwe").as_deref(), Some("ZW"));
    assert_eq!(cat.country_code("ZW").as_deref(), Some("ZW"));
    assert_eq!(cat.country_code("Narnia"), None);
}
