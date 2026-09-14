"""The ISO 639-3 registry and the filter resolution rules, offline.

Every rule the Worker implements is pinned here, in the order it is applied:
an exact tag, then a bare code that exists only as varieties, then a name from
the aliases. A tag always beats a name, and nothing unresolvable is guessed at.
"""

from __future__ import annotations

from typing import List

import pytest

from ngano import Catalogue, Filter, LanguageCode, LanguageRegistry
from ngano.languages import (
    canonicalise_tag,
    default_registry,
    resolve_language,
    resolve_languages,
    slugify_name,
)


@pytest.fixture(scope="module")
def registry() -> LanguageRegistry:
    """The bundled registry, parsed once."""
    return default_registry()


# ----------------------------------------------------------------- the registry


def test_registry_is_bundled_and_keyed_on_tags(registry: LanguageRegistry) -> None:
    assert len(registry) == 315
    assert sum(1 for code in registry.codes if code.is_variety) == 27
    for code in registry.codes:
        assert code.tag == (
            code.iso639_3 if code.region is None else f"{code.iso639_3}-{code.region}"
        )


def test_language_code_shape(registry: LanguageRegistry) -> None:
    nigerian = registry.get("eng-NG")
    assert isinstance(nigerian, LanguageCode)
    assert nigerian.iso639_3 == "eng"
    assert nigerian.region == "NG"
    assert nigerian.name == "English (Nigeria)"
    assert nigerian.is_variety is True
    assert "Nigerian English" in nigerian.aliases
    assert nigerian.to_dict()["tag"] == "eng-NG"

    shona = registry.get("sna")
    assert shona is not None
    assert shona.region is None and shona.is_variety is False
    assert shona.scope == "I" and shona.type == "L"


def test_catalogue_exposes_the_registry() -> None:
    cat = Catalogue()
    codes = cat.language_codes()
    assert len(codes) == 315
    assert {code.tag for code in codes} >= {"sna", "swh", "eng-NG", "por-MZ"}
    assert cat.resolve_language("isiZulu") == "zul"
    assert cat.resolve_language("nothing-like-a-language") is None


# --------------------------------------------------------------- rule 1: tags


def test_tag_resolution_is_case_insensitive_and_canonicalised() -> None:
    for value in ("sna", "SNA", "Sna", "  sna  "):
        assert resolve_language(value) == ["sna"]
    for value in ("eng-NG", "eng-ng", "ENG-NG", "Eng-Ng"):
        assert resolve_language(value) == ["eng-NG"]


def test_canonicalise_tag_accepts_only_tag_shaped_values() -> None:
    assert canonicalise_tag("ENG-ng") == "eng-NG"
    assert canonicalise_tag("por-mz") == "por-MZ"
    assert canonicalise_tag("sna") == "sna"
    # A region may also be a UN M.49 area number, which BCP 47 allows.
    assert canonicalise_tag("ara-002") == "ara-002"
    for value in ("Shona", "en", "english", "sn", "sna-NGA", ""):
        assert canonicalise_tag(value) is None


def test_an_unknown_but_tag_shaped_value_resolves_to_nothing() -> None:
    assert resolve_language("zzz") == []
    assert resolve_language("sna-ZW") == []


# ------------------------------------------- rule 2: a code with varieties only


def test_a_bare_code_that_exists_only_as_varieties_resolves_to_them() -> None:
    # German is catalogued only as the Namibian variety, so `deu` can mean
    # nothing else and resolves to it without include_varieties.
    assert resolve_language("deu") == ["deu-NA"]
    assert resolve_language("DEU") == ["deu-NA"]


def test_a_bare_code_with_its_own_tag_never_widens_by_default() -> None:
    assert resolve_language("eng") == ["eng"]
    assert resolve_language("swh") == ["swh"]


# --------------------------------------------------------------- rule 3: names


def test_a_name_resolves_plain_or_slugified() -> None:
    assert resolve_language("isiZulu") == ["zul"]
    assert resolve_language("ISIZULU") == ["zul"]
    assert resolve_language("Zulu") == ["zul"]
    assert resolve_language("isizulu") == ["zul"]
    assert resolve_language("English (Nigeria)") == ["eng-NG"]
    assert resolve_language("english-nigeria") == ["eng-NG"]
    assert resolve_language("Nigerian English") == ["eng-NG"]


def test_slugify_strips_accents_and_punctuation() -> None:
    assert slugify_name("English (Nigeria)") == "english-nigeria"
    assert slugify_name("Côte d'Ivoire French") == "cote-d-ivoire-french"
    assert slugify_name("   ") == ""


def test_unresolvable_input_yields_no_guess() -> None:
    for value in ("", "   ", "Many African languages", "multiple", "German", "xyzzy"):
        assert resolve_language(value) == []


# ------------------------------------------------------- the `tem` collision


def test_a_tag_beats_a_name_for_the_tem_collision(registry: LanguageRegistry) -> None:
    # `tem` is the tag of Timne. "Tem" is also the name of `kdh`. The tag wins.
    timne = registry.get("tem")
    tem_the_name = registry.get("kdh")
    assert timne is not None and timne.name == "Timne"
    assert tem_the_name is not None and tem_the_name.name == "Tem"
    for spelling in ("tem", "TEM", "Tem"):
        assert resolve_language(spelling) == ["tem"]
    # Timne's own alias still reaches Timne, and neither spelling reaches kdh.
    assert resolve_language("Temne") == ["tem"]


# --------------------------------------------------------- include_varieties


def test_include_varieties_puts_the_bare_tag_first() -> None:
    widened = resolve_language("eng", include_varieties=True)
    assert widened[0] == "eng"
    assert "eng-NG" in widened and "eng-ZA" in widened
    assert all(tag == "eng" or tag.startswith("eng-") for tag in widened)
    assert len(widened) == len(set(widened))
    assert len(widened) > len(resolve_language("eng"))


def test_include_varieties_widens_a_name_too() -> None:
    by_name = resolve_language("Portuguese", include_varieties=True)
    by_code = resolve_language("por", include_varieties=True)
    assert by_name == by_code
    assert by_name[0] == "por"
    assert "por-MZ" in by_name


def test_include_varieties_leaves_a_variety_tag_alone() -> None:
    assert resolve_language("eng-NG", include_varieties=True) == ["eng-NG"]


def test_include_varieties_changes_nothing_for_a_language_with_none() -> None:
    assert resolve_language("sna", include_varieties=True) == ["sna"]


def test_resolve_many_deduplicates_and_keeps_order() -> None:
    assert resolve_languages(["sna", "isiZulu", "SNA", "Shona"]) == ["sna", "zul"]
    assert resolve_languages(["nope", "sna"]) == ["sna"]
    assert resolve_languages([]) == []


def test_resolve_one_never_widens(registry: LanguageRegistry) -> None:
    assert registry.resolve_one("eng") == "eng"
    assert registry.resolve_one("deu") == "deu-NA"
    assert registry.resolve_one("nothing here") is None


def test_varieties_and_name_helpers(registry: LanguageRegistry) -> None:
    assert set(registry.varieties("eng")) >= {"eng", "eng-NG", "eng-ZA"}
    assert registry.varieties("sna") == ["sna"]
    assert registry.varieties("zzz") == []
    assert registry.name("eng-NG") == "English (Nigeria)"
    assert registry.name("zzz") == "zzz"
    assert "eng-NG" in registry and "zzz" not in registry


def test_registry_carries_the_non_language_placeholders(
    registry: LanguageRegistry,
) -> None:
    assert "multiple" in registry.not_a_language
    assert registry.descriptive
    for phrase in registry.descriptive:
        assert resolve_language(phrase) == []


# ------------------------------------------------------- filtering on tags


def test_filter_resolves_every_accepted_spelling() -> None:
    cat = Catalogue()
    expected = [record.id for record in cat.datasets(language="sna")]
    assert expected
    for spelling in ("SNA", "Shona", "shona"):
        assert [record.id for record in cat.datasets(language=spelling)] == expected
    # iso= is the code-shaped spelling of the same filter.
    assert [record.id for record in cat.datasets(iso="sna")] == expected


def test_back_compat_name_filtering_still_works() -> None:
    cat = Catalogue()
    zulu = cat.datasets(language="isiZulu")
    assert zulu
    for record in zulu:
        assert "zul" in record.language_tags


def test_filter_matches_on_tags_not_on_free_text_names() -> None:
    cat = Catalogue()
    nigerian = cat.datasets(language="eng-NG")
    assert nigerian
    for record in nigerian:
        assert "eng-NG" in record.language_tags
    # A bare code does not pick up the country-specific varieties by itself.
    plain = {record.id for record in cat.datasets(language="eng")}
    assert not plain & {record.id for record in nigerian if "eng" not in record.language_tags}


def test_include_varieties_widens_a_catalogue_filter() -> None:
    cat = Catalogue()
    narrow = {record.id for record in cat.datasets(language="eng")}
    wide = {record.id for record in cat.datasets(language="eng", include_varieties=True)}
    assert narrow < wide
    fluent = {
        record.id
        for record in cat.datasets(Filter().language("eng").include_varieties())
    }
    assert fluent == wide


def test_language_and_iso_are_or_ed_into_one_set() -> None:
    cat = Catalogue()
    both = {record.id for record in cat.datasets(language="sna", iso="zul")}
    union = {record.id for record in cat.datasets(language="sna")} | {
        record.id for record in cat.datasets(language="zul")
    }
    assert both == union


def test_an_unresolvable_filter_matches_nothing_rather_than_everything() -> None:
    cat = Catalogue()
    assert cat.datasets(language="Many African languages") == []
    assert cat.datasets(language="xyzzy") == []
    assert Filter(language="xyzzy").resolved_language_tags() == []


def test_resolved_language_tags_reports_what_the_filter_will_match() -> None:
    assert Filter(language="Shona").resolved_language_tags() == ["sna"]
    assert Filter().resolved_language_tags() == []
    widened: List[str] = Filter(iso="eng", include_varieties=True).resolved_language_tags()
    assert widened[0] == "eng" and len(widened) > 1


def test_to_params_keeps_the_callers_spelling_and_flags_varieties() -> None:
    params = Filter(language=["sna", "Shona"], iso="eng", include_varieties=True).to_params()
    assert params["language"] == "sna,Shona"
    assert params["iso"] == "eng"
    assert params["include_varieties"] == "true"


def test_from_mapping_accepts_the_language_parameters() -> None:
    built = Filter.from_mapping(
        {"language": "sna", "iso": "zul", "include_varieties": True, "nonsense": 1}
    )
    assert built.get("language") == ["sna"]
    assert built.get("iso") == ["zul"]
    assert built.get("include_varieties") is True


# ------------------------------------------------- catalogue language records


def test_language_records_are_keyed_on_tags_and_reproduce_the_data_file() -> None:
    cat = Catalogue()
    languages = cat.languages()
    assert len(languages) == 315
    by_tag = {language.tag: language for language in languages}
    shona = by_tag["sna"]
    assert shona.name == "Shona"
    assert shona.slug == "sna"
    assert shona.iso639_3 == "sna"
    assert shona.region is None
    assert shona.datasets > 0
    assert shona.countries and len(shona.countries) == len(shona.country_codes)
    assert shona.tasks == sorted(shona.tasks)

    nigerian = by_tag["eng-NG"]
    assert nigerian.region == "NG"
    assert nigerian.iso639_3 == "eng"

    # The recomputed counts match the published languages.json exactly.
    from ngano.data_files import read_json

    published = read_json("languages.json")
    assert isinstance(published, list)
    for raw in published:
        record = by_tag[raw["tag"]]
        assert record.datasets == raw["datasets"]
        assert record.hours == pytest.approx(raw["hours"])
        assert record.countries == raw["countries"]
        assert record.country_codes == raw["country_codes"]
        assert record.tasks == raw["tasks"]


def test_language_lookup_accepts_tag_code_slug_and_name() -> None:
    cat = Catalogue()
    for value in ("sna", "SNA", "Shona", "shona"):
        assert cat.language(value).tag == "sna"
    for value in ("eng-NG", "eng-ng", "Nigerian English"):
        assert cat.language(value).tag == "eng-NG"
    with pytest.raises(Exception):
        cat.language("not-a-language-at-all")


def test_include_varieties_does_not_widen_a_name_that_names_a_variety() -> None:
    """Only an entry with no region has varieties to widen to."""
    assert resolve_language("Nigerian English", include_varieties=True) == ["eng-NG"]
    assert resolve_language("English (Nigeria)", include_varieties=True) == ["eng-NG"]
    assert resolve_language("Namibian German", include_varieties=True) == ["deu-NA"]


def test_widened_varieties_come_back_in_registry_order(
    registry: LanguageRegistry,
) -> None:
    """The bare tag first, then every variety in document order, not sorted."""
    document_order = [tag for tag in registry.varieties("eng") if tag != "eng"]
    assert resolve_language("eng", include_varieties=True) == ["eng"] + document_order
    assert document_order != sorted(document_order)  # order is the file's, not sorted
