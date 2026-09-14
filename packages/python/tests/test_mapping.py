"""Column mapping tests against realistic dataset schemas."""

from __future__ import annotations

from typing import Any, Dict

from conftest import (
    COMMON_VOICE_ROWS,
    FLEURS_ROWS,
    MILLISECONDS_ROWS,
    ODDBALL_ROWS,
)

from ngano.mapping import FieldMap, build_row, normalise_column
from ngano.models import Row


def _plan_and_row(field_map: FieldMap, row: Dict[str, Any], repo: str) -> Any:
    """Plan the columns of one row and map it, as the loader would."""
    plan = field_map.plan(list(row.keys()), repo)
    return plan, build_row(row, plan, split="train", hf_repo=repo)


def test_normalise_column_ignores_case_underscores_and_hyphens() -> None:
    assert normalise_column("Client_ID") == normalise_column("client-id") == "clientid"
    assert normalise_column("WAV PATH") == "wavpath"


def test_common_voice_style_columns(field_map: FieldMap) -> None:
    plan, row = _plan_and_row(field_map, COMMON_VOICE_ROWS[0], "example/common-voice-like")
    assert row.transcript == "Mhoro nyika"
    assert row.speaker_id == "cv-speaker-1"
    assert row.language == "sn"
    assert row.gender == "male_masculine"
    assert row.age == "twenties"
    assert row.audio is not None
    assert row.audio.path == "sn/clip1.mp3"
    assert row.audio.sampling_rate == 48000
    assert row.sampling_rate == 48000
    # The drop list is discarded rather than kept as an extra.
    for dropped in ("up_votes", "down_votes", "segment"):
        assert dropped not in row.extra
        assert dropped in plan.dropped
    # accent is a country alias in the field map, so it is claimed, not dropped.
    assert plan.mapping["country"] == "accent"
    assert row.country is None  # the fixture's accent is empty, so nothing is claimed
    assert "_ngano_unmapped" not in row.extra


def test_fleurs_style_columns_use_the_repo_override(field_map: FieldMap) -> None:
    plan, row = _plan_and_row(field_map, FLEURS_ROWS[0], "google/fleurs")
    assert plan.used_override is True
    assert row.transcript == "habari ya asubuhi"
    assert row.language == "Swahili"
    # The row's own language column resolves to exactly one tag, so the row is
    # attributed to it and the code is that tag's, not the corpus's lang_id.
    assert row.language_tag == "swh"
    assert row.language_iso == "swh"
    assert row.audio is not None and row.audio.path == "sw_ke/train/1.wav"
    # Unmapped columns survive, dropped ones do not.
    assert row.extra["raw_transcription"] == "Habari ya asubuhi."
    assert "id" not in row.extra
    assert "num_samples" not in row.extra


def test_oddball_schema_maps_what_it_can_and_records_the_rest(field_map: FieldMap) -> None:
    plan, row = _plan_and_row(field_map, ODDBALL_ROWS[0], "example/oddball")
    # Case, hyphens and underscores are ignored when matching aliases.
    assert row.transcript == "sawubona"
    assert row.speaker_id == "spk-9"
    # WAV_PATH is an audio alias, so it is claimed and the URL is picked up.
    assert plan.mapping["audio"] == "WAV_PATH"
    assert row.audio is not None
    assert row.audio.url == "https://example.org/clips/zu-1.wav"
    assert row.audio.bytes is None  # still nothing fetched
    assert "_ngano_unmapped" not in row.extra
    assert row.extra["Notes"] == "field recording"


def test_claiming_is_table_driven_only(field_map: FieldMap) -> None:
    # Every claim comes from the alias table, never from a local heuristic, so
    # the three SDKs map identically. A column the table does not list is an extra.
    for column, canonical in (
        ("mp3", "audio"),
        ("audio_url", "audio"),
        ("recording", "audio"),
        ("caption", "transcript"),
        ("voice_gender", "gender"),
        ("origin_country", "country"),
    ):
        plan = field_map.plan([column], "example/x")
        assert plan.mapping.get(canonical) == column, column
    unknown = field_map.plan(["mystery_column"], "example/x")
    assert unknown.mapping == {}
    assert unknown.extras == ("mystery_column",)


def test_duration_ms_is_converted_to_seconds(field_map: FieldMap) -> None:
    plan, row = _plan_and_row(field_map, MILLISECONDS_ROWS[0], "example/millis")
    assert plan.conversions["duration_s"] == ("duration_ms", 0.001)
    assert row.duration_s == 2.5
    assert row.transcript == "bonjour le monde"
    assert row.language == "Wolof"
    assert row.sampling_rate == 16000
    assert row.audio is not None and row.audio.path == "/data/clips/fr-1.wav"
    assert "duration_ms" not in row.extra


def test_unknown_schema_never_raises(field_map: FieldMap) -> None:
    raw = {"alpha": 1, "beta": "two"}
    plan = field_map.plan(list(raw.keys()), "example/unknown")
    row = build_row(raw, plan)
    assert row.transcript is None
    assert row.audio is None
    assert row.extra["alpha"] == 1
    assert "transcript" in row.extra["_ngano_unmapped"]


def test_catalogue_values_are_only_fallbacks(field_map: FieldMap) -> None:
    plan = field_map.plan(["sentence", "audio", "locale"], "example/x")
    row = build_row(
        {"sentence": "a", "audio": {"path": "x.wav"}, "locale": "sn"},
        plan,
        language="Shona",
        country="ZW",
        domain="read",
    )
    assert row.language == "sn"  # the source row wins
    assert row.country == "ZW"  # the catalogue fills a gap
    assert row.domain == "read"


def test_row_to_dict_hides_audio_bytes(field_map: FieldMap) -> None:
    plan = field_map.plan(["sentence", "audio"], "example/x")
    row = build_row({"sentence": "a", "audio": {"path": "x.wav", "bytes": b"RIFF"}}, plan)
    payload = row.to_dict()
    assert payload["audio"] == {
        "url": None,
        "path": "x.wav",
        "sampling_rate": None,
        "has_bytes": True,
    }


def test_row_carries_the_language_tag_and_the_bare_code(field_map: FieldMap) -> None:
    """The canonical row gained language_tag, and language_iso is the bare code."""
    plan = field_map.plan(["sentence", "audio"], "example/x")
    row = build_row(
        {"sentence": "mhoro", "audio": {"path": "x.wav"}},
        plan,
        language="Shona",
        language_iso="sna",
        language_tag="sna",
    )
    assert row.language == "Shona"
    assert row.language_iso == "sna"
    assert row.language_tag == "sna"
    payload = row.to_dict()
    assert payload["language_tag"] == "sna"
    assert payload["language_iso"] == "sna"


def test_a_source_code_wins_over_the_catalogue_code(field_map: FieldMap) -> None:
    """A code the row states itself decides the row's tag, not the record's."""
    plan = field_map.plan(["sentence", "audio", "iso_639_3"], "example/x")
    row = build_row(
        {"sentence": "a", "audio": {"path": "x.wav"}, "iso_639_3": "ndc"},
        plan,
        language_iso="sna",
        language_tag="sna",
    )
    assert row.language_tag == "ndc"
    assert row.language_iso == "ndc"


def test_an_unresolvable_source_code_survives_verbatim(field_map: FieldMap) -> None:
    """An ISO 639-1 code is reported as the source wrote it, never rewritten."""
    plan = field_map.plan(["sentence", "audio", "iso_639_3"], "example/x")
    row = build_row(
        {"sentence": "a", "audio": {"path": "x.wav"}, "iso_639_3": "sw"},
        plan,
        language_iso="swh",
        language_tag="swh",
    )
    assert row.language_iso == "sw"      # kept as stated, not resolved
    assert row.language_tag == "swh"     # the record names one language


def test_a_multilingual_record_attributes_no_row_by_itself(field_map: FieldMap) -> None:
    """A row of a many-language corpus is not attributed to the first language."""
    plan = field_map.plan(["sentence", "audio"], "example/many")
    row = build_row({"sentence": "a", "audio": {"path": "x.wav"}}, plan)
    assert row.language_tag is None
    assert row.language_iso is None


def test_a_multilingual_record_uses_what_the_row_states(field_map: FieldMap) -> None:
    """The row's own value places it, whichever language the record lists first."""
    plan = field_map.plan(["sentence", "audio", "locale"], "example/many")
    row = build_row({"sentence": "a", "audio": {"path": "x.wav"}, "locale": "yor"}, plan)
    assert row.language_tag == "yor"
    assert row.language_iso == "yor"


def test_a_row_tag_column_is_mapped_and_canonicalised(field_map: FieldMap) -> None:
    """field_map now carries a language_tag alias group, so the column is used."""
    plan = field_map.plan(["sentence", "audio", "bcp47"], "example/x")
    assert plan.mapping["language_tag"] == "bcp47"
    row = build_row(
        {"sentence": "a", "audio": {"path": "x.wav"}, "bcp47": "eng-ng"},
        plan,
        language_tag="sna",
        language_iso="sna",
    )
    assert row.language_tag == "eng-NG"
    assert row.language_iso == "eng"


def test_row_field_order_is_the_canonical_one() -> None:
    """Every ngano SDK agrees on this shape, so its keys are pinned here."""
    assert list(Row().to_dict()) == [
        "audio",
        "transcript",
        "language",
        "language_iso",
        "language_tag",
        "country",
        "speaker_id",
        "gender",
        "age",
        "duration_s",
        "sampling_rate",
        "domain",
        "split",
        "dataset_id",
        "hf_repo",
        "licence",
        "source_url",
        "extra",
    ]
