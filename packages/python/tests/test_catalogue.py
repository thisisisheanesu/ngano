"""Catalogue tests, including the bundled offline snapshot."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import pytest

from ngano import Catalogue, DatasetNotFoundError, __version__
from ngano.data_files import SNAPSHOT_FILES, read_json


def test_version_is_semver() -> None:
    parts = __version__.split(".")
    assert len(parts) == 3 and all(part.isdigit() for part in parts)


def test_every_snapshot_file_is_bundled() -> None:
    for name in SNAPSHOT_FILES:
        assert read_json(name)


def test_bundled_catalogue_loads_offline(monkeypatch: pytest.MonkeyPatch) -> None:
    def forbidden(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("the bundled catalogue must not touch the network")

    import socket

    monkeypatch.setattr(socket.socket, "connect", forbidden)
    cat = Catalogue()
    assert len(cat) > 500
    assert cat.source == "bundled"


def test_get_by_id_and_by_repo() -> None:
    cat = Catalogue()
    record = cat.get("waxal-corpus-paper")
    assert record.id == "waxal-corpus-paper"
    by_repo = cat.get("google/fleurs")
    assert by_repo.hf_repo == "google/fleurs"
    assert cat.find("no-such-dataset") is None
    with pytest.raises(DatasetNotFoundError) as excinfo:
        cat.get("no-such-dataset")
    assert "no-such-dataset" in str(excinfo.value)


def test_search_ranks_name_matches_first() -> None:
    hits = Catalogue().search("parliament")
    assert hits
    assert "parliament" in hits[0].name.casefold()


def test_datasets_filter_on_the_real_snapshot() -> None:
    cat = Catalogue()
    records = cat.datasets(language="Shona", commercial=True, task="ASR")
    assert records
    for record in records:
        assert record.task == "ASR"
        assert record.commercial == "Yes"
        assert "Shona" in record.languages or "Shona" in record.languages_clean


def test_stats_exclude_unverified_hours(catalogue: Catalogue) -> None:
    stats = catalogue.stats()
    assert stats["datasets"] == 3
    assert stats["hours"] == 160.0  # 120 + 40, the 25,000 hour claim is excluded
    assert stats["unverified"] == {"datasets": 1, "excluded_hours": 25000.0}
    assert stats["loadable"] == 2
    assert json.dumps(stats)  # stays JSON serialisable


def test_countries_and_languages_counts(catalogue: Catalogue) -> None:
    zw = catalogue.country("zw")
    assert zw.datasets == 3
    assert zw.hours == 160.0
    assert zw.languages == 2
    shona = catalogue.language("shona")
    assert shona.datasets == 2
    assert shona.hours == 120.0
    assert shona.countries == ["Zimbabwe"]


def test_real_snapshot_stats_are_consistent() -> None:
    cat = Catalogue()
    stats = cat.stats()
    assert stats["datasets"] == len(cat)
    assert stats["loadable"] == sum(1 for record in cat if record.hf_repo)
    manual = sum(record.countable_hours for record in cat)
    assert stats["hours"] == pytest.approx(manual, rel=1e-6)
    assert stats["unverified"]["datasets"] == sum(1 for r in cat if r.unverified_size)


def test_from_api_reads_pages(monkeypatch: pytest.MonkeyPatch) -> None:
    pages: Dict[str, Any] = {
        1: {
            "data": [{"id": "a", "name": "A", "hf_repo": "x/a"}],
            "meta": {"page": 1, "total_pages": 2},
        },
        2: {"data": [{"id": "b", "name": "B"}], "meta": {"page": 2, "total_pages": 2}},
    }

    class FakeResponse:
        def __init__(self, payload: Any) -> None:
            self.payload = payload
            self.status_code = 200

        def json(self) -> Any:
            return self.payload

    class FakeSession:
        def __init__(self) -> None:
            self.calls: List[str] = []

        def get(
            self, url: str, params: Optional[Dict[str, Any]] = None, timeout: float = 0
        ) -> FakeResponse:
            self.calls.append(url)
            if url.endswith("/datasets"):
                return FakeResponse(pages[int((params or {}).get("page", 1))])
            if url.endswith("/countries"):
                return FakeResponse([{"name": "Zimbabwe", "iso2": "ZW"}])
            if url.endswith("/languages"):
                return FakeResponse([{"name": "Shona", "slug": "shona"}])
            return FakeResponse(read_json("field_map.json"))

    session = FakeSession()
    cat = Catalogue.from_api(session=session)
    assert len(cat) == 2
    assert cat.source == "https://ngano.dev/api/v1"
    assert cat.get("a").hf_repo == "x/a"
    assert any(call.endswith("/schema") for call in session.calls)


def test_records_carry_language_tags_and_codes() -> None:
    cat = Catalogue()
    record = cat.get("google/fleurs")
    assert record.language_tags
    assert record.language_codes
    for tag in record.language_tags:
        assert cat.resolve_language(tag) == tag
    # Codes are the bare primaries of the tags, deduplicated.
    assert record.language_codes == list(dict.fromkeys(
        tag.split("-")[0] for tag in record.language_tags
    ))


def test_language_note_records_describe_their_coverage_in_prose() -> None:
    cat = Catalogue()
    noted = [record for record in cat if record.language_note]
    assert len(noted) == 11
    for record in noted:
        assert record.language_note
        assert record.language_tags == []
        assert record.language_codes == []
        # The prose is preserved in the record's dict, not dropped.
        assert record.to_dict()["language_note"] == record.language_note


def test_a_prose_record_is_never_matched_by_a_language_filter() -> None:
    cat = Catalogue()
    noted = {record.id for record in cat if record.language_note}
    matched = {record.id for record in cat.datasets(language="swh")}
    assert noted and not (noted & matched)


def test_tags_are_derived_for_a_payload_without_them() -> None:
    """An API response from before the re-key still filters correctly."""
    cat = Catalogue(
        records=[{"id": "old", "name": "Old", "languages_clean": ["isiZulu"], "iso": ["zul"]}],
        countries=[],
        languages=[],
        source="test",
    )
    record = cat.get("old")
    assert record.language_tags == ["zul"]
    assert record.language_codes == ["zul"]
    assert [r.id for r in cat.datasets(language="zul")] == ["old"]


def test_stats_count_languages_by_tag_and_by_code() -> None:
    cat = Catalogue()
    stats = cat.stats()
    assert stats["languages"] == len(cat.languages())
    assert stats["language_codes"] <= stats["languages"]
    assert stats["language_codes"] == len({code.iso639_3 for code in cat.language_codes()
                                           if any(code.tag in r.language_tags for r in cat)})
    for entry in stats["top_languages"]:
        assert cat.resolve_language(entry["tag"]) == entry["tag"]
        assert entry["name"]
