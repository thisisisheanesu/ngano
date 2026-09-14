//! Language identity: the registry, the resolution rules and the filters built
//! on them. Everything here reads the bundled snapshot, so it is fully offline.

mod common;

use ngano::{canonicalise_tag, Catalogue, Filter, LanguageRegistry};

fn registry() -> LanguageRegistry {
    LanguageRegistry::bundled().expect("the bundled registry parses")
}

fn catalogue() -> Catalogue {
    Catalogue::bundled().expect("the bundled catalogue parses")
}

/* -------------------------------------------------------------------------- */
/* Rule 1: an exact tag, case insensitively                                   */
/* -------------------------------------------------------------------------- */

#[test]
fn an_exact_tag_resolves_whatever_its_case() {
    let reg = registry();
    for spelling in ["sna", "SNA", "Sna", " sna "] {
        assert_eq!(reg.resolve(spelling, false), vec!["sna".to_string()]);
    }
    for spelling in ["eng-NG", "eng-ng", "ENG-NG", "Eng-Ng"] {
        assert_eq!(reg.resolve(spelling, false), vec!["eng-NG".to_string()]);
    }
}

#[test]
fn tags_are_canonicalised_to_lowercase_primary_and_uppercase_region() {
    assert_eq!(canonicalise_tag("SNA").as_deref(), Some("sna"));
    assert_eq!(canonicalise_tag("eng-ng").as_deref(), Some("eng-NG"));
    assert_eq!(canonicalise_tag("POR-mz").as_deref(), Some("por-MZ"));
    // Not tag-shaped at all, so nothing to canonicalise.
    assert_eq!(canonicalise_tag("en"), None);
    assert_eq!(canonicalise_tag("Shona"), None);
    assert_eq!(canonicalise_tag("eng-NGA"), None);
}

#[test]
fn a_regional_tag_is_never_the_same_selection_as_its_bare_code() {
    let cat = catalogue();
    let nigerian = cat.datasets(&Filter::new().language("eng-NG"));
    let english = cat.datasets(&Filter::new().language("eng"));
    assert!(!nigerian.is_empty());
    assert!(!english.is_empty());
    assert!(nigerian
        .iter()
        .all(|d| d.language_tags.iter().any(|t| t == "eng-NG")));
    assert!(english
        .iter()
        .all(|d| d.language_tags.iter().any(|t| t == "eng")));
}

/* -------------------------------------------------------------------------- */
/* Rule 2: a bare code that exists only as regional varieties                  */
/* -------------------------------------------------------------------------- */

#[test]
fn a_code_that_is_only_regional_resolves_to_its_varieties() {
    let reg = registry();
    // German appears in the catalogue only as the Namibian variety, so `deu`
    // can mean nothing else.
    assert!(reg.get("deu").is_none());
    assert_eq!(reg.resolve("deu", false), vec!["deu-NA".to_string()]);
    assert_eq!(reg.resolve("DEU", false), vec!["deu-NA".to_string()]);

    let cat = catalogue();
    let by_code = cat.datasets(&Filter::new().language("deu"));
    let by_tag = cat.datasets(&Filter::new().language("deu-NA"));
    assert!(!by_tag.is_empty());
    assert_eq!(by_code.len(), by_tag.len());
}

/* -------------------------------------------------------------------------- */
/* Rule 3: a name from the aliases, plain or slugified                        */
/* -------------------------------------------------------------------------- */

#[test]
fn a_name_resolves_in_any_case_plain_or_slugified() {
    let reg = registry();
    for spelling in ["isiZulu", "isizulu", "ISIZULU", "Zulu", "zulu"] {
        assert_eq!(reg.resolve(spelling, false), vec!["zul".to_string()]);
    }
    // Accents and punctuation fold away in the slug form.
    assert_eq!(reg.resolve("Baoulé", false), vec!["bci".to_string()]);
    assert_eq!(reg.resolve("baoule", false), vec!["bci".to_string()]);
    assert_eq!(reg.resolve("Ghomala'", false), vec!["bbj".to_string()]);
    assert_eq!(reg.resolve("ghomala", false), vec!["bbj".to_string()]);
    // A source spelling from the name index, slugified.
    assert_eq!(
        reg.resolve("congolese-swahili", false),
        vec!["swc".to_string()]
    );
}

#[test]
fn a_tag_always_beats_a_name() {
    let reg = registry();
    // `tem` is the tag for Timne, and "Tem" is also the name of `kdh`.
    assert_eq!(reg.get("tem").map(|c| c.name.as_str()), Some("Timne"));
    assert_eq!(reg.get("kdh").map(|c| c.name.as_str()), Some("Tem"));
    // The tag wins in every case, so the name "Tem" never reaches `kdh`.
    for spelling in ["tem", "TEM", "Tem"] {
        assert_eq!(reg.resolve(spelling, false), vec!["tem".to_string()]);
    }
    // Timne's own alias resolves to Timne too, and `kdh` keeps its tag.
    assert_eq!(reg.resolve("Temne", false), vec!["tem".to_string()]);
    assert_eq!(reg.resolve("kdh", false), vec!["kdh".to_string()]);

    let cat = catalogue();
    let timne = cat.datasets(&Filter::new().language("Tem"));
    let kdh = cat.datasets(&Filter::new().language("kdh"));
    assert!(timne
        .iter()
        .all(|d| d.language_tags.iter().any(|t| t == "tem")));
    assert!(kdh
        .iter()
        .all(|d| d.language_tags.iter().any(|t| t == "kdh")));
}

/* -------------------------------------------------------------------------- */
/* Widening, and refusing to guess                                            */
/* -------------------------------------------------------------------------- */

#[test]
fn a_bare_code_only_widens_when_asked() {
    let reg = registry();
    assert_eq!(reg.resolve("eng", false), vec!["eng".to_string()]);

    let widened = reg.resolve("eng", true);
    assert_eq!(widened.first().map(String::as_str), Some("eng"));
    assert!(widened.len() > 1);
    assert!(widened[1..].iter().all(|t| t.starts_with("eng-")));
    let mut sorted = widened.clone();
    sorted.sort();
    sorted.dedup();
    assert_eq!(sorted.len(), widened.len(), "tags are not repeated");

    // A name widens the same way, because it resolves to the same bare tag.
    assert_eq!(reg.resolve("English", true), widened);
    // A regional tag has nothing to widen to.
    assert_eq!(reg.resolve("eng-NG", true), vec!["eng-NG".to_string()]);
}

#[test]
fn widening_a_filter_keeps_a_superset() {
    let cat = catalogue();
    let plain = cat.datasets(&Filter::new().language("eng"));
    let wide = cat.datasets(&Filter::new().language("eng").include_varieties(true));
    assert!(wide.len() > plain.len());
    for d in &plain {
        assert!(wide.iter().any(|w| w.id == d.id));
    }
    // A language with no varieties is unaffected.
    let sna = cat.datasets(&Filter::new().language("sna"));
    let sna_wide = cat.datasets(&Filter::new().language("sna").include_varieties(true));
    assert_eq!(sna.len(), sna_wide.len());
}

#[test]
fn unresolvable_input_matches_nothing_and_is_never_guessed_at() {
    let reg = registry();
    for spelling in ["", "   ", "Klingon", "zzz", "multiple", "various", "eng-"] {
        assert!(
            reg.resolve(spelling, false).is_empty(),
            "{spelling} should resolve to nothing"
        );
        assert!(reg.resolve(spelling, true).is_empty());
    }

    let cat = catalogue();
    assert!(cat.datasets(&Filter::new().language("Klingon")).is_empty());
    assert_eq!(
        Filter::new().language("Klingon").unresolved_languages(),
        vec!["Klingon".to_string()]
    );
    assert!(Filter::new()
        .language("sna")
        .unresolved_languages()
        .is_empty());
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

#[test]
fn a_name_a_code_and_a_tag_select_the_same_records() {
    let cat = catalogue();
    let by_name = cat.datasets(&Filter::new().language("isiZulu"));
    let by_other_name = cat.datasets(&Filter::new().language("Zulu"));
    let by_code = cat.datasets(&Filter::new().language("zul"));
    let by_iso = cat.datasets(&Filter::new().iso("ZUL"));
    assert!(!by_name.is_empty());
    assert_eq!(by_name.len(), by_code.len());
    assert_eq!(by_name.len(), by_other_name.len());
    assert_eq!(by_name.len(), by_iso.len());
    assert!(by_name
        .iter()
        .all(|d| d.language_tags.iter().any(|t| t == "zul")));
}

#[test]
fn iso_is_the_code_shaped_spelling_of_language() {
    assert_eq!(
        Filter::new().iso("sna").resolved_languages(),
        Filter::new().language("sna").resolved_languages()
    );
    assert_eq!(
        Filter::new()
            .language("sna")
            .iso("zul")
            .resolved_languages(),
        vec!["sna".to_string(), "zul".to_string()]
    );
}

#[test]
fn several_languages_are_ored_together() {
    let cat = catalogue();
    let sna = cat.datasets(&Filter::new().language("sna"));
    let zul = cat.datasets(&Filter::new().language("zul"));
    let both = cat.datasets(&Filter::new().language("sna").language("isiZulu"));
    assert!(both.len() >= sna.len().max(zul.len()));
    assert!(both.len() <= sna.len() + zul.len());
}

#[test]
fn resolved_languages_keeps_order_and_drops_duplicates() {
    let f = Filter::new()
        .language("sna")
        .language("Shona")
        .language("eng-ng");
    assert_eq!(
        f.resolved_languages(),
        vec!["sna".to_string(), "eng-NG".to_string()]
    );
}

/* -------------------------------------------------------------------------- */
/* The catalogue records themselves                                           */
/* -------------------------------------------------------------------------- */

#[test]
fn every_record_carries_canonical_tags_and_bare_codes() {
    let cat = catalogue();
    let reg = registry();
    for d in cat.all() {
        for tag in &d.language_tags {
            assert_eq!(
                canonicalise_tag(tag).as_deref(),
                Some(tag.as_str()),
                "{} has a non-canonical tag {tag}",
                d.id
            );
            let entry = reg
                .get(tag)
                .unwrap_or_else(|| panic!("{} names an unknown tag {tag}", d.id));
            assert!(
                d.language_codes.contains(&entry.iso639_3),
                "{} lists {tag} but not its code {}",
                d.id,
                entry.iso639_3
            );
        }
        for code in &d.language_codes {
            assert_eq!(code.len(), 3, "{} has a non-bare code {code}", d.id);
            assert_eq!(*code, code.to_lowercase());
        }
    }
}

#[test]
fn records_that_describe_their_coverage_in_prose_carry_a_note() {
    let cat = catalogue();
    let noted: Vec<_> = cat
        .all()
        .iter()
        .filter(|d| d.language_note.is_some())
        .collect();
    assert!(!noted.is_empty(), "the catalogue carries language notes");
    for d in &noted {
        assert!(!d.language_note.as_deref().unwrap().trim().is_empty());
    }
    let prose = cat
        .get("global-recordings-network-grn-audio-library")
        .expect("the GRN record is catalogued");
    assert!(prose.language_tags.is_empty());
    assert!(prose.language_codes.is_empty());
    assert!(prose.language_note.is_some());
    assert!(!prose.languages.is_empty(), "the source wording is kept");
}

#[test]
fn the_coverage_list_and_the_registry_agree() {
    let cat = catalogue();
    let reg = registry();
    for l in cat.languages() {
        let entry = reg
            .get(&l.tag)
            .unwrap_or_else(|| panic!("{} is not in the registry", l.tag));
        assert_eq!(entry.name, l.name);
        assert_eq!(entry.iso639_3, l.iso639_3);
        assert_eq!(l.slug, l.tag.to_lowercase());
    }
    assert_eq!(cat.language_codes().len(), reg.codes().len());
    let regional = cat
        .language_codes()
        .iter()
        .filter(|c| c.region.is_some())
        .count();
    assert_eq!(regional, 27);
}

#[test]
fn stats_count_tags_and_codes_separately() {
    let cat = catalogue();
    let s = cat.stats();
    assert!(s.languages > 0);
    assert!(
        s.language_codes <= s.languages,
        "varieties collapse into their code"
    );
    assert!(s.language_codes < s.languages);
}
