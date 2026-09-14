"""Filter builder tests."""

from __future__ import annotations

from ngano import Catalogue, Filter


def test_kwargs_and_fluent_build_the_same_filter() -> None:
    by_kwargs = Filter(language="Shona", task="ASR", commercial=True)
    fluent = Filter().language("Shona").task("ASR").commercial()
    assert by_kwargs == fluent
    assert by_kwargs.get("language") == ["Shona"]


def test_comma_separated_and_sequence_values_are_equivalent() -> None:
    assert Filter(language="Shona,Ndebele") == Filter(language=["Shona", "Ndebele"])


def test_commercial_true_means_yes_only(catalogue: Catalogue) -> None:
    ids = [record.id for record in catalogue.datasets(commercial=True)]
    assert ids == ["shona-voices"]


def test_include_purchasable_widens_commercial(catalogue: Catalogue) -> None:
    ids = sorted(
        record.id for record in catalogue.datasets(commercial=True, include_purchasable=True)
    )
    assert ids == ["ndebele-radio", "shona-voices"]


def test_explicit_commercial_value_is_respected(catalogue: Catalogue) -> None:
    ids = [record.id for record in catalogue.datasets(commercial="Unstated")]
    assert ids == ["archive-only"]


def test_params_are_and_ed_across_and_or_ed_within(catalogue: Catalogue) -> None:
    both = catalogue.datasets(language=["Shona", "Ndebele"], task="ASR")
    assert sorted(record.id for record in both) == ["ndebele-radio", "shona-voices"]
    none = catalogue.datasets(language="Shona", task="TTS")
    assert none == []


def test_country_matches_alpha2_and_name(catalogue: Catalogue) -> None:
    assert len(catalogue.datasets(country="ZW")) == 3
    assert len(catalogue.datasets(country="Zimbabwe")) == 3
    assert catalogue.datasets(country="KE") == []


def test_hf_only_and_hours_bounds(catalogue: Catalogue) -> None:
    assert len(catalogue.datasets(hf_only=True)) == 2
    assert [r.id for r in catalogue.datasets(min_hours=100, max_hours=1000)] == ["shona-voices"]


def test_sort_orders_results(catalogue: Catalogue) -> None:
    ids = [r.id for r in catalogue.datasets(Filter(hf_only=True).sort("-hours"))]
    assert ids == ["shona-voices", "ndebele-radio"]


def test_to_params_mirrors_the_api_query_string() -> None:
    params = Filter(
        language=["Shona", "Ndebele"], commercial=True, include_purchasable=True, hf_only=True
    ).to_params()
    assert params["language"] == "Shona,Ndebele"
    assert params["commercial"] == "Yes,Yes, if purchased"
    assert params["hf_only"] == "true"
    assert "include_purchasable" not in params


def test_merge_lets_kwargs_win() -> None:
    base = Filter(language="Shona", task="ASR")
    merged = base.merge(Filter(task="TTS"))
    assert merged.get("task") == ["TTS"]
    assert merged.get("language") == ["Shona"]


def test_empty_filter_keeps_everything(catalogue: Catalogue) -> None:
    assert Filter().is_empty()
    assert len(catalogue.datasets()) == len(catalogue)
