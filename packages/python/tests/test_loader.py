"""Streaming loader tests. Fully mocked, so nothing is downloaded."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import pytest
from conftest import COMMON_VOICE_ROWS, FLEURS_ROWS, CountingSource, opener_for

from ngano import Catalogue, Filter, GatedDatasetError, Stream, load, load_dataset
from ngano.errors import LoaderError
from ngano.loader import open_streaming_dataset


def _rows(prefix: str, count: int) -> List[Dict[str, Any]]:
    """Build a list of simple common-voice-like rows."""
    return [
        {
            "sentence": f"{prefix}-{index}",
            "audio": {"path": f"{prefix}/{index}.wav", "sampling_rate": 16000},
            "locale": prefix,
        }
        for index in range(count)
    ]


def _stream(catalogue: Catalogue, sources: Dict[str, CountingSource], **kwargs: Any) -> Stream:
    """Build a stream over the fixture catalogue with a fake opener."""
    stream = load(catalogue=catalogue, **kwargs)
    stream._opener = opener_for(sources)
    return stream


def test_load_reports_matched_and_loadable(catalogue: Catalogue) -> None:
    stream = load(catalogue=catalogue, country="ZW")
    assert stream.matched == 3
    assert stream.loadable == 2
    assert "matched=3" in repr(stream)


def test_load_warns_once_when_few_matches_are_loadable() -> None:
    records = [
        {"id": f"paper-{i}", "name": f"Paper {i}", "languages": ["Shona"], "hf_repo": None}
        for i in range(9)
    ]
    records.append({"id": "one", "name": "One", "languages": ["Shona"], "hf_repo": "x/one"})
    cat = Catalogue(records=records, countries=[], languages=[], source="test")
    with pytest.warns(RuntimeWarning, match="only 1 have a Hugging Face repo"):
        stream = load(catalogue=cat, language="Shona")
    assert (stream.matched, stream.loadable) == (10, 1)


def test_single_dataset_rows_are_canonical(catalogue: Catalogue) -> None:
    sources = {"example/shona-voices": CountingSource(COMMON_VOICE_ROWS)}
    stream = _stream(catalogue, sources, language="Shona", commercial=True)
    rows = list(stream)
    assert len(rows) == 2
    first = rows[0]
    assert first.transcript == "Mhoro nyika"
    assert first.dataset_id == "shona-voices"
    assert first.hf_repo == "example/shona-voices"
    assert first.licence == "CC-BY-4.0"
    assert first.source_url == "https://huggingface.co/datasets/example/shona-voices"
    assert first.country == "ZW"
    assert first.split == "train"
    assert first.domain == "read"


def test_round_robin_alternates_between_datasets(catalogue: Catalogue) -> None:
    sources = {
        "example/shona-voices": CountingSource(_rows("sn", 3)),
        "example/ndebele-radio": CountingSource(_rows("nd", 3)),
    }
    stream = _stream(catalogue, sources, country="ZW", hf_only=True)
    transcripts = [row.transcript for row in stream]
    assert transcripts == ["sn-0", "nd-0", "sn-1", "nd-1", "sn-2", "nd-2"]


def test_sequential_keeps_datasets_in_order(catalogue: Catalogue) -> None:
    sources = {
        "example/shona-voices": CountingSource(_rows("sn", 2)),
        "example/ndebele-radio": CountingSource(_rows("nd", 2)),
    }
    stream = _stream(catalogue, sources, country="ZW", hf_only=True, interleave="sequential")
    assert [row.transcript for row in stream] == ["sn-0", "sn-1", "nd-0", "nd-1"]


def test_weighted_by_hours_favours_the_larger_corpus(catalogue: Catalogue) -> None:
    # The fixture catalogue gives Shona 120 hours and Ndebele 40, a 3 to 1 split.
    sources = {
        "example/shona-voices": CountingSource(_rows("sn", 12)),
        "example/ndebele-radio": CountingSource(_rows("nd", 12)),
    }
    stream = _stream(
        catalogue, sources, country="ZW", hf_only=True, interleave="weighted_by_hours", limit=8
    )
    transcripts = [row.transcript for row in stream]
    shona = sum(1 for name in transcripts if name.startswith("sn"))
    assert len(transcripts) == 8
    assert shona == 6  # three quarters of the rows, deterministically


def test_round_robin_drains_the_longer_dataset(catalogue: Catalogue) -> None:
    sources = {
        "example/shona-voices": CountingSource(_rows("sn", 4)),
        "example/ndebele-radio": CountingSource(_rows("nd", 1)),
    }
    stream = _stream(catalogue, sources, country="ZW", hf_only=True)
    assert [row.transcript for row in stream] == ["sn-0", "nd-0", "sn-1", "sn-2", "sn-3"]


def test_breaking_early_leaves_the_source_unexhausted(catalogue: Catalogue) -> None:
    source = CountingSource(_rows("sn", 500))
    stream = _stream(catalogue, {"example/shona-voices": source}, language="Shona", commercial=True)
    seen = []
    for row in stream:
        seen.append(row.transcript)
        if len(seen) == 3:
            break
    assert seen == ["sn-0", "sn-1", "sn-2"]
    assert source.consumed == 3
    assert source.exhausted is False


def test_limit_stops_without_exhausting_any_source(catalogue: Catalogue) -> None:
    shona = CountingSource(_rows("sn", 100))
    ndebele = CountingSource(_rows("nd", 100))
    stream = _stream(
        catalogue,
        {"example/shona-voices": shona, "example/ndebele-radio": ndebele},
        country="ZW",
        hf_only=True,
        limit=4,
    )
    assert len(list(stream)) == 4
    assert (shona.consumed, ndebele.consumed) == (2, 2)
    assert not shona.exhausted and not ndebele.exhausted


def test_take_is_lazy(catalogue: Catalogue) -> None:
    source = CountingSource(_rows("sn", 50))
    stream = _stream(catalogue, {"example/shona-voices": source}, language="Shona", commercial=True)
    assert len(stream.take(2)) == 2
    assert source.consumed == 2


def test_plan_is_computed_once_per_repo(catalogue: Catalogue) -> None:
    source = CountingSource(COMMON_VOICE_ROWS)
    stream = _stream(catalogue, {"example/shona-voices": source}, language="Shona", commercial=True)
    assert stream.plans == {}
    list(stream)
    plan = stream.plans["example/shona-voices"]
    assert plan.mapping["transcript"] == "sentence"
    assert plan.mapping["speaker_id"] == "client_id"


def test_columns_fall_back_to_the_first_row(catalogue: Catalogue) -> None:
    source = CountingSource(COMMON_VOICE_ROWS)

    def opener(repo: str, **kwargs: Any) -> Any:
        return source, None  # a dataset that declares no features

    stream = load(catalogue=catalogue, language="Shona", commercial=True)
    stream._opener = opener
    rows = list(stream)
    assert rows[0].transcript == "Mhoro nyika"


def test_failing_dataset_is_skipped_with_a_warning(catalogue: Catalogue) -> None:
    def opener(repo: str, **kwargs: Any) -> Any:
        if repo == "example/shona-voices":
            raise LoaderError("boom")
        return CountingSource(_rows("nd", 2)), ["sentence", "audio", "locale"]

    stream = load(catalogue=catalogue, country="ZW", hf_only=True)
    stream._opener = opener
    with pytest.warns(RuntimeWarning, match="skipping example/shona-voices"):
        rows = list(stream)
    assert [row.transcript for row in rows] == ["nd-0", "nd-1"]


def test_on_error_raise_propagates(catalogue: Catalogue) -> None:
    def opener(repo: str, **kwargs: Any) -> Any:
        raise LoaderError("boom")

    stream = load(catalogue=catalogue, country="ZW", hf_only=True, on_error="raise")
    stream._opener = opener
    with pytest.raises(LoaderError):
        list(stream)


def test_invalid_interleave_is_rejected(catalogue: Catalogue) -> None:
    with pytest.raises(ValueError, match="interleave must be one of"):
        load(catalogue=catalogue, interleave="random")


def test_load_dataset_uses_catalogue_metadata(catalogue: Catalogue) -> None:
    stream = load_dataset("example/shona-voices", catalogue=catalogue, limit=1)
    stream._opener = opener_for({"example/shona-voices": CountingSource(COMMON_VOICE_ROWS)})
    row = list(stream)[0]
    assert row.dataset_id == "shona-voices"
    assert row.licence == "CC-BY-4.0"
    assert stream.matched == 1 and stream.loadable == 1


def test_load_dataset_accepts_an_uncatalogued_repo(catalogue: Catalogue) -> None:
    stream = load_dataset("google/fleurs", config="sw_ke", catalogue=catalogue)
    stream._opener = opener_for({"google/fleurs": CountingSource(FLEURS_ROWS)})
    row = list(stream)[0]
    assert row.dataset_id is None
    assert row.hf_repo == "google/fleurs"
    assert row.source_url == "https://huggingface.co/datasets/google/fleurs"
    assert row.transcript == "habari ya asubuhi"


def test_config_is_passed_to_the_opener(catalogue: Catalogue) -> None:
    seen: Dict[str, Any] = {}

    def opener(repo: str, config: Optional[str] = None, **kwargs: Any) -> Any:
        seen["config"] = config
        seen.update(kwargs)
        return CountingSource(FLEURS_ROWS), None

    stream = load_dataset("google/fleurs", config="sw_ke", split="test", catalogue=catalogue)
    stream._opener = opener
    list(stream)
    assert seen["config"] == "sw_ke"
    assert seen["split"] == "test"


def test_to_jsonl_writes_rows_without_bytes(catalogue: Catalogue, tmp_path: Any) -> None:
    stream = _stream(
        catalogue,
        {"example/shona-voices": CountingSource(COMMON_VOICE_ROWS)},
        language="Shona",
        commercial=True,
    )
    path = tmp_path / "rows.jsonl"
    written = stream.to_jsonl(str(path))
    assert written == 2
    lines = path.read_text(encoding="utf-8").strip().split("\n")
    payload = json.loads(lines[0])
    assert payload["transcript"] == "Mhoro nyika"
    assert payload["audio"]["has_bytes"] is False


def test_gated_repo_gets_a_clear_message(monkeypatch: pytest.MonkeyPatch) -> None:
    import datasets as hf_datasets

    def fake_load_dataset(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("401 Client Error: Unauthorized for url ...")

    monkeypatch.setattr(hf_datasets, "load_dataset", fake_load_dataset)
    with pytest.raises(GatedDatasetError) as excinfo:
        open_streaming_dataset("some/gated-corpus")
    message = str(excinfo.value)
    assert "some/gated-corpus" in message
    assert "https://huggingface.co/datasets/some/gated-corpus" in message
    assert "HF_TOKEN" in message


def test_other_open_failures_are_loader_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    import datasets as hf_datasets

    def fake_load_dataset(*args: Any, **kwargs: Any) -> None:
        raise ValueError("BuilderConfig 'nope' not found")

    monkeypatch.setattr(hf_datasets, "load_dataset", fake_load_dataset)
    with pytest.raises(LoaderError) as excinfo:
        open_streaming_dataset("some/repo", config="nope")
    assert "some/repo" in str(excinfo.value)
    assert "nope" in str(excinfo.value)


def test_token_resolution_order(monkeypatch: pytest.MonkeyPatch) -> None:
    from ngano.auth import resolve_token

    monkeypatch.delenv("HF_TOKEN", raising=False)
    monkeypatch.delenv("HUGGING_FACE_HUB_TOKEN", raising=False)
    assert resolve_token() is None
    monkeypatch.setenv("HUGGING_FACE_HUB_TOKEN", "hub")
    assert resolve_token() == "hub"
    monkeypatch.setenv("HF_TOKEN", "hf")
    assert resolve_token() == "hf"
    assert resolve_token("explicit") == "explicit"


def test_token_reaches_the_audio_handle(catalogue: Catalogue) -> None:
    stream = load(catalogue=catalogue, language="Shona", commercial=True, hf_token="hf_secret")
    stream._opener = opener_for({"example/shona-voices": CountingSource(COMMON_VOICE_ROWS)})
    row = list(stream)[0]
    assert row.audio is not None and row.audio.token == "hf_secret"


def test_filter_object_and_kwargs_combine(catalogue: Catalogue) -> None:
    stream = load(filter=Filter(country="ZW"), catalogue=catalogue, task="ASR")
    assert stream.matched == 2


def test_rows_carry_the_catalogue_language_tag(catalogue: Catalogue) -> None:
    """The tag, the bare code and the canonical name all come from the record."""
    source = CountingSource([{"sentence": "mhoro", "audio": {"path": "a.wav"}}])
    stream = _stream(catalogue, {"example/shona-voices": source}, language="sna")
    row = list(stream)[0]
    assert row.language_tag == "sna"
    assert row.language_iso == "sna"
    assert row.language == "Shona"


def test_a_source_language_wins_over_the_catalogue_name(catalogue: Catalogue) -> None:
    """The source keeps its own spelling, while the tag stays canonical."""
    source = CountingSource(COMMON_VOICE_ROWS)
    stream = _stream(catalogue, {"example/shona-voices": source}, language="sna")
    row = list(stream)[0]
    assert row.language == "sn"  # the locale column, as the source states it
    assert row.language_tag == "sna"
    assert row.language_iso == "sna"


def test_an_uncatalogued_repo_has_no_tag(catalogue: Catalogue) -> None:
    """Nothing is guessed for a repo the catalogue does not know."""
    source = CountingSource([{"sentence": "hello", "audio": {"path": "a.wav"}}])
    stream = load_dataset("someone/not-catalogued", catalogue=catalogue)
    stream._opener = opener_for({"someone/not-catalogued": source})
    row = list(stream)[0]
    assert row.language_tag is None
    assert row.language_iso is None
    assert row.dataset_id is None


def test_stream_selection_is_by_tag(catalogue: Catalogue) -> None:
    """load() selects the records whose tags match, whatever spelling was given."""
    by_tag = load(catalogue=catalogue, language="sna")
    by_name = load(catalogue=catalogue, language="Shona")
    assert [record.id for record in by_tag.records] == [record.id for record in by_name.records]
    assert by_tag.matched == by_name.matched
    assert load(catalogue=catalogue, language="xyzzy").matched == 0


def _multilingual_catalogue() -> Catalogue:
    """A catalogue whose one record covers several languages."""
    return Catalogue(
        records=[
            {
                "id": "many-tongues",
                "name": "Many Tongues",
                "languages": ["Shona", "Yoruba", "isiZulu"],
                "languages_clean": ["Shona", "Yoruba", "isiZulu"],
                "language_tags": ["sna", "yor", "zul"],
                "language_codes": ["sna", "yor", "zul"],
                "hf_repo": "example/many-tongues",
                "hours_num": 30.0,
            }
        ],
        countries=[],
        languages=[],
        source="test",
    )


def test_a_multilingual_record_leaves_a_silent_row_unattributed() -> None:
    """Three tags and a row that says nothing means no tag, never the first one."""
    cat = _multilingual_catalogue()
    source = CountingSource([{"sentence": "a", "audio": {"path": "a.wav"}}])
    stream = load(catalogue=cat, language="sna")
    stream._opener = opener_for({"example/many-tongues": source})
    row = list(stream)[0]
    assert row.language_tag is None
    assert row.language_iso is None
    assert row.language is None


def test_a_multilingual_record_honours_what_the_row_states() -> None:
    """The row's own language places it, whatever the record lists first."""
    cat = _multilingual_catalogue()
    source = CountingSource(
        [
            {"sentence": "a", "audio": {"path": "a.wav"}, "locale": "yor"},
            {"sentence": "b", "audio": {"path": "b.wav"}, "locale": "isiZulu"},
        ]
    )
    stream = load(catalogue=cat, language="sna")
    stream._opener = opener_for({"example/many-tongues": source})
    rows = list(stream)
    assert [row.language_tag for row in rows] == ["yor", "zul"]
    assert [row.language_iso for row in rows] == ["yor", "zul"]
    assert [row.language for row in rows] == ["yor", "isiZulu"]  # as the source wrote it
