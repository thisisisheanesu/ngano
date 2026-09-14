"""Shared fixtures. Every test here runs offline, with no network and no token."""

from __future__ import annotations

from typing import Any, Dict, Iterator, List, Mapping, Optional, Sequence, Tuple

import pytest

from ngano.catalogue import Catalogue
from ngano.mapping import FieldMap


class CountingSource:
    """A fake streaming dataset that records how many rows were consumed.

    Used to prove that ngano never pulls more rows than the caller asked for.

    Attributes:
        consumed: Rows actually pulled from the underlying generator.
        exhausted: Whether the generator ran to completion.
    """

    def __init__(self, rows: Sequence[Mapping[str, Any]], columns: Optional[List[str]] = None):
        """Store the rows and the declared columns."""
        self.rows = list(rows)
        self.columns = list(columns) if columns is not None else list(self.rows[0].keys())
        self.consumed = 0
        self.exhausted = False

    def __iter__(self) -> Iterator[Mapping[str, Any]]:
        """Yield rows one at a time, counting as it goes."""
        for row in self.rows:
            self.consumed += 1
            yield row
        self.exhausted = True


COMMON_VOICE_ROWS: List[Dict[str, Any]] = [
    {
        "client_id": "cv-speaker-1",
        "path": "sn/clip1.mp3",
        "audio": {"path": "sn/clip1.mp3", "bytes": None, "sampling_rate": 48000},
        "sentence": "Mhoro nyika",
        "up_votes": 3,
        "down_votes": 0,
        "age": "twenties",
        "gender": "male_masculine",
        "accent": "",
        "locale": "sn",
        "segment": "",
    },
    {
        "client_id": "cv-speaker-2",
        "path": "sn/clip2.mp3",
        "audio": {"path": "sn/clip2.mp3", "bytes": None, "sampling_rate": 48000},
        "sentence": "Tinotenda",
        "up_votes": 2,
        "down_votes": 1,
        "age": "thirties",
        "gender": "female_feminine",
        "accent": "",
        "locale": "sn",
        "segment": "",
    },
]

FLEURS_ROWS: List[Dict[str, Any]] = [
    {
        "id": 7,
        "num_samples": 96000,
        "path": "sw_ke/train/1.wav",
        "audio": {"path": "sw_ke/train/1.wav", "bytes": None, "sampling_rate": 16000},
        "transcription": "habari ya asubuhi",
        "raw_transcription": "Habari ya asubuhi.",
        "gender": 0,
        "lang_id": 78,
        "language": "Swahili",
        "lang_group_id": 2,
    }
]

ODDBALL_ROWS: List[Dict[str, Any]] = [
    {
        "Text": "sawubona",
        "WAV_PATH": "https://example.org/clips/zu-1.wav",
        "Speaker-Name": "spk-9",
        "Notes": "field recording",
    }
]

MILLISECONDS_ROWS: List[Dict[str, Any]] = [
    {
        "utterance": "bonjour le monde",
        "audio_filepath": "/data/clips/fr-1.wav",
        "duration_ms": 2500,
        "lang": "Wolof",
        "sample_rate": 16000,
    }
]


@pytest.fixture()
def field_map() -> FieldMap:
    """The bundled field map."""
    return FieldMap.default()


@pytest.fixture()
def catalogue() -> Catalogue:
    """A small synthetic catalogue that never touches the bundled snapshot."""
    records = [
        {
            "id": "shona-voices",
            "name": "Shona Voices",
            "task": "ASR",
            "languages": ["chiShona"],
            "languages_clean": ["Shona"],
            "language_tags": ["sna"],
            "language_codes": ["sna"],
            "iso": ["sna"],
            "countries": ["Zimbabwe"],
            "country_codes": ["ZW"],
            "regions": ["Southern Africa"],
            "hours": "120",
            "hours_num": 120.0,
            "licence": "CC-BY-4.0",
            "licence_class": "Attribution (CC-BY)",
            "commercial": "Yes",
            "access": "Open",
            "host": "HuggingFace",
            "url": "https://huggingface.co/datasets/example/shona-voices",
            "hf_repo": "example/shona-voices",
            "domain": "read",
            "unverified_size": False,
        },
        {
            "id": "ndebele-radio",
            "name": "Ndebele Radio",
            "task": "ASR",
            "languages": ["Ndebele"],
            "languages_clean": ["Northern Ndebele"],
            "language_tags": ["nde"],
            "language_codes": ["nde"],
            "iso": ["nde"],
            "countries": ["Zimbabwe"],
            "country_codes": ["ZW"],
            "regions": ["Southern Africa"],
            "hours": "40",
            "hours_num": 40.0,
            "licence": "CC-BY-SA-4.0",
            "licence_class": "ShareAlike (CC-BY-SA)",
            "commercial": "Yes, if purchased",
            "access": "Paid",
            "host": "HuggingFace",
            "url": "https://huggingface.co/datasets/example/ndebele-radio",
            "hf_repo": "example/ndebele-radio",
            "unverified_size": False,
        },
        {
            "id": "archive-only",
            "name": "Archive Only Corpus",
            "task": "Raw source",
            "languages": ["Shona"],
            "languages_clean": ["Shona"],
            "countries": ["Zimbabwe"],
            "country_codes": ["ZW"],
            "regions": ["Southern Africa"],
            "hours_num": 25000.0,
            "hours": "25000",
            "commercial": "Unstated",
            "access": "Request",
            "host": "University archive",
            "url": "https://example.ac.zw/archive",
            "hf_repo": None,
            "unverified_size": True,
        },
    ]
    countries = [
        {
            "name": "Zimbabwe",
            "iso2": "ZW",
            "iso3": "ZWE",
            "map_name": "Zimbabwe",
            "lat": -19.0,
            "lon": 29.0,
            "region": "Southern Africa",
            "slug": "zw",
        }
    ]
    languages = [
        {
            "tag": "sna",
            "iso639_3": "sna",
            "region": None,
            "name": "Shona",
            "scope": "I",
            "type": "L",
            "aliases": ["Shona", "chiShona"],
            "slug": "sna",
        },
        {
            "tag": "nde",
            "iso639_3": "nde",
            "region": None,
            "name": "Northern Ndebele",
            "scope": "I",
            "type": "L",
            "aliases": ["Ndebele", "Northern Ndebele"],
            "slug": "nde",
        },
    ]
    return Catalogue(
        records=records,
        countries=countries,
        languages=languages,
        field_map=_bundled_field_map_payload(),
        source="test",
    )


def _bundled_field_map_payload() -> Dict[str, Any]:
    """Return the bundled field map as a raw payload."""
    from ngano.data_files import read_json

    payload = read_json("field_map.json")
    assert isinstance(payload, dict)
    return payload


def opener_for(
    sources: Mapping[str, CountingSource],
) -> Any:
    """Build a fake dataset opener backed by in-memory sources.

    Args:
        sources: Repo id to the fake dataset that should be returned.

    Returns:
        A callable with the signature of
        :func:`ngano.loader.open_streaming_dataset`.
    """

    def opener(
        repo: str,
        config: Optional[str] = None,
        split: str = "train",
        token: Optional[str] = None,
        streaming: bool = True,
    ) -> Tuple[CountingSource, Optional[List[str]]]:
        source = sources[repo]
        return source, source.columns

    return opener
