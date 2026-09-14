"""Dataclasses for the ngano canonical row and the catalogue records.

The canonical row is shared by every ngano SDK. A row produced by the Python
loader has exactly the fields listed in :class:`Row`, in the same units, no
matter which Hugging Face dataset it came from.
"""

from __future__ import annotations

import builtins
import io
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Tuple

from .errors import MissingDependencyError

__all__ = ["AudioRef", "Row", "DatasetRecord", "CountryRecord", "LanguageRecord"]


def _as_str(value: Any) -> Optional[str]:
    """Coerce a raw catalogue or row value to a string, keeping ``None``."""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


@dataclass
class AudioRef:
    """A lazy handle on one audio clip.

    Nothing is downloaded or decoded when a row is produced. Bytes are fetched
    only by :meth:`read`, and samples only by :meth:`decode`.

    Attributes:
        url: Remote URL for the clip, when the source row carries one.
        path: Local or archive-relative path, when the source row carries one.
        sampling_rate: Sample rate in Hz as stated by the source, if known.
        bytes: Audio bytes already present in the source row, if any. Streaming
            Hugging Face datasets often carry them inline.

    Example:
        >>> ref = AudioRef(path="/tmp/clip.wav")
        >>> ref.url is None
        True
    """

    url: Optional[str] = None
    path: Optional[str] = None
    sampling_rate: Optional[int] = None
    bytes: Optional[builtins.bytes] = None
    token: Optional[str] = field(default=None, repr=False, compare=False)

    def __post_init__(self) -> None:
        """Normalise a path that is really a URL."""
        if self.url is None and self.path and self.path.startswith(("http://", "https://")):
            self.url = self.path

    @property
    def is_resolvable(self) -> bool:
        """Whether :meth:`read` has somewhere to read from."""
        return bool(self.bytes or self.url or (self.path and os.path.exists(self.path)))

    def read(self) -> builtins.bytes:
        """Return the raw encoded audio bytes, fetching them if needed.

        Inline bytes are returned as they are. Otherwise a local path is read
        from disk, and failing that the URL is fetched over HTTPS with the
        Hugging Face token attached when one is available.

        Returns:
            The encoded file contents, for example WAV or MP3 bytes.

        Raises:
            NganoError: If the handle has no bytes, no readable path and no URL.

        Example:
            >>> AudioRef(bytes=b"RIFF").read()
            b'RIFF'
        """
        from .errors import NganoError

        if self.bytes is not None:
            return self.bytes
        if self.path and os.path.exists(self.path):
            with open(self.path, "rb") as handle:
                self.bytes = handle.read()
            return self.bytes
        if self.url:
            import requests

            headers = {}
            if self.token and "huggingface.co" in self.url:
                headers["Authorization"] = f"Bearer {self.token}"
            response = requests.get(self.url, headers=headers, timeout=60)
            response.raise_for_status()
            self.bytes = response.content
            return self.bytes
        raise NganoError(
            "this audio handle has no bytes, no readable local path and no URL, "
            "so there is nothing to read"
        )

    def decode(self) -> Tuple[Any, int]:
        """Decode the clip to samples.

        Returns:
            A tuple of the waveform as a NumPy array and the sample rate in Hz.

        Raises:
            MissingDependencyError: If soundfile is not installed. Install the
                ``ngano[audio]`` extra.

        Example::

            array, sr = row.audio.decode()
        """
        try:
            import soundfile
        except ImportError as exc:  # pragma: no cover - import guard
            raise MissingDependencyError(
                "soundfile", "audio", "decoding audio with AudioRef.decode()"
            ) from exc

        payload = self.read()
        array, sample_rate = soundfile.read(io.BytesIO(payload))
        self.sampling_rate = int(sample_rate)
        return array, int(sample_rate)

    def to_dict(self) -> Dict[str, Any]:
        """Return a JSON-friendly dict, without the bytes and the token."""
        return {
            "url": self.url,
            "path": self.path,
            "sampling_rate": self.sampling_rate,
            "has_bytes": self.bytes is not None,
        }


@dataclass
class Row:
    """One canonical utterance, identical in shape across every ngano SDK.

    Attributes:
        audio: Lazy :class:`AudioRef`, or ``None`` when the source row has no
            audio column that ngano could identify.
        transcript: Reference text, or ``None``.
        language: Language name as the source labels it, falling back to the
            catalogue's canonical name when the record names one language.
        language_iso: Bare ISO 639-3 code: the primary subtag of
            :attr:`language_tag` when the row's own value resolved, otherwise
            the code the source stated when ngano cannot place it, otherwise the
            record's code when it names one language.
        language_tag: BCP 47 tag, an ISO 639-3 primary subtag plus an optional
            region subtag, for example ``sna`` or ``eng-NG``. Resolved from the
            row's own language value, otherwise from the catalogue record when
            that record names exactly one language, otherwise ``None``.
        country: ISO 3166-1 alpha-2 code, from the row or the catalogue entry.
        speaker_id: Stable speaker identifier within the dataset.
        gender: Speaker gender exactly as stated by the source, never inferred.
        age: Speaker age or age band as stated by the source, never inferred.
        duration_s: Utterance duration in seconds.
        sampling_rate: Sample rate in Hz.
        domain: Recording domain, for example read speech or broadcast.
        split: Source split name.
        dataset_id: ngano catalogue id, or ``None`` for a repo outside the
            catalogue.
        hf_repo: Hugging Face repo id the row was streamed from.
        licence: Licence string from the catalogue.
        source_url: Canonical URL for the dataset.
        extra: Every source column ngano did not map, plus diagnostics under
            keys beginning with ``_ngano_``.
    """

    audio: Optional[AudioRef] = None
    transcript: Optional[str] = None
    language: Optional[str] = None
    language_iso: Optional[str] = None
    language_tag: Optional[str] = None
    country: Optional[str] = None
    speaker_id: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[str] = None
    duration_s: Optional[float] = None
    sampling_rate: Optional[int] = None
    domain: Optional[str] = None
    split: str = "train"
    dataset_id: Optional[str] = None
    hf_repo: Optional[str] = None
    licence: Optional[str] = None
    source_url: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self, include_extra: bool = True) -> Dict[str, Any]:
        """Return a JSON-serialisable dict for this row.

        Args:
            include_extra: Keep the ``extra`` mapping. Set false for a compact
                record with only the canonical fields.

        Returns:
            A dict whose ``audio`` value is the audio handle metadata, never
            the audio bytes.
        """
        payload: Dict[str, Any] = {
            "audio": self.audio.to_dict() if self.audio else None,
            "transcript": self.transcript,
            "language": self.language,
            "language_iso": self.language_iso,
            "language_tag": self.language_tag,
            "country": self.country,
            "speaker_id": self.speaker_id,
            "gender": self.gender,
            "age": self.age,
            "duration_s": self.duration_s,
            "sampling_rate": self.sampling_rate,
            "domain": self.domain,
            "split": self.split,
            "dataset_id": self.dataset_id,
            "hf_repo": self.hf_repo,
            "licence": self.licence,
            "source_url": self.source_url,
        }
        if include_extra:
            payload["extra"] = _jsonable(self.extra)
        return payload


def _jsonable(value: Any) -> Any:
    """Return a best-effort JSON-serialisable copy of an arbitrary value."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, bytes):
        return f"<{len(value)} bytes>"
    if isinstance(value, Mapping):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]
    return str(value)


@dataclass
class DatasetRecord:
    """One catalogue entry, as published in ``data/catalogue.json``.

    Figures such as :attr:`hours_num` are reproduced as the source published
    them. When :attr:`unverified_size` is true the figure is a self-reported
    claim of 20,000 hours or more and ngano excludes it from every total.

    Attributes:
        languages: Language names exactly as the source spells them.
        languages_clean: Canonical display names, one per entry of
            :attr:`language_tags`.
        language_tags: Ordered BCP 47 tags, the values every ngano language
            filter matches on. The primary subtag is always an ISO 639-3
            three-letter code, and a region subtag marks a country-specific
            variety, so Nigerian English is ``eng-NG``.
        language_codes: The bare ISO 639-3 codes behind :attr:`language_tags`,
            deduplicated, order preserved.
        iso: The ISO codes as first catalogued. Prefer :attr:`language_codes`.
        language_note: Present on the few records whose source describes its
            coverage in prose, for example "~340 African languages", rather than
            naming individual languages. Such a record carries no tags, and this
            string says so.
    """

    id: str
    name: str
    task: Optional[str] = None
    variety: Optional[str] = None
    languages: List[str] = field(default_factory=list)
    languages_clean: List[str] = field(default_factory=list)
    language_tags: List[str] = field(default_factory=list)
    language_codes: List[str] = field(default_factory=list)
    iso: List[str] = field(default_factory=list)
    countries: List[str] = field(default_factory=list)
    country_codes: List[str] = field(default_factory=list)
    regions: List[str] = field(default_factory=list)
    hours: Optional[str] = None
    hours_num: Optional[float] = None
    speakers: Optional[str] = None
    recording_type: Optional[str] = None
    quality: Optional[str] = None
    labelled: Optional[str] = None
    domain: Optional[str] = None
    licence: Optional[str] = None
    licence_class: Optional[str] = None
    commercial: Optional[str] = None
    access: Optional[str] = None
    host: Optional[str] = None
    url: Optional[str] = None
    hf_repo: Optional[str] = None
    year: Optional[str] = None
    notes: Optional[str] = None
    language_note: Optional[str] = None
    unverified_size: bool = False
    extra: Dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def loadable(self) -> bool:
        """Whether :func:`ngano.load` can stream this record.

        Only records with a Hugging Face repo can be streamed.
        """
        return bool(self.hf_repo)

    @property
    def countable_hours(self) -> float:
        """Hours that may be added to a total.

        Returns ``0.0`` for records flagged :attr:`unverified_size`, per the
        ngano rule that self-reported figures of 20,000 hours or more are
        excluded from every total.
        """
        if self.unverified_size or self.hours_num is None:
            return 0.0
        return float(self.hours_num)

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "DatasetRecord":
        """Build a record from a catalogue or API JSON object.

        Unknown keys are kept in :attr:`extra` so a newer API stays readable.

        Args:
            payload: A single dataset object.

        Returns:
            The parsed record.
        """
        known = {f for f in cls.__dataclass_fields__ if f != "extra"}
        kwargs: Dict[str, Any] = {}
        extra: Dict[str, Any] = {}
        for key, value in payload.items():
            if key in known:
                kwargs[key] = value
            else:
                extra[key] = value
        kwargs.setdefault("id", str(payload.get("id", "")))
        kwargs.setdefault("name", str(payload.get("name", kwargs.get("id", ""))))
        for list_field in (
            "languages",
            "languages_clean",
            "language_tags",
            "language_codes",
            "iso",
            "countries",
            "country_codes",
            "regions",
        ):
            value = kwargs.get(list_field)
            if value is None:
                kwargs[list_field] = []
            elif isinstance(value, str):
                kwargs[list_field] = [value]
            else:
                kwargs[list_field] = list(value)
        if kwargs.get("hours_num") is not None:
            try:
                kwargs["hours_num"] = float(kwargs["hours_num"])
            except (TypeError, ValueError):
                kwargs["hours_num"] = None
        if not kwargs["language_tags"]:
            # A payload that predates the ISO 639-3 re-key carries names only.
            # Resolving them here keeps an older API response filterable.
            from .languages import default_registry

            tags, codes = default_registry().tags_for(
                list(kwargs["languages_clean"] or kwargs["languages"]) + list(kwargs["iso"])
            )
            kwargs["language_tags"] = tags
            if not kwargs["language_codes"]:
                kwargs["language_codes"] = codes
        kwargs["unverified_size"] = bool(kwargs.get("unverified_size", False))
        for str_field in ("hours", "speakers", "year"):
            if str_field in kwargs:
                kwargs[str_field] = _as_str(kwargs[str_field])
        return cls(extra=extra, **kwargs)

    def to_dict(self) -> Dict[str, Any]:
        """Return the record as a plain JSON-serialisable dict."""
        payload = asdict(self)
        nested = payload.pop("extra", {})
        payload.update(nested)
        return payload


@dataclass
class CountryRecord:
    """A country with its catalogue counts.

    Attributes:
        datasets: Number of catalogue records covering the country.
        hours: Total hours across those records, excluding unverified figures.
        languages: Number of distinct languages recorded in the country.
    """

    name: str
    iso2: str
    iso3: Optional[str] = None
    map_name: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    region: Optional[str] = None
    slug: Optional[str] = None
    datasets: int = 0
    hours: float = 0.0
    languages: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Return the country as a plain JSON-serialisable dict."""
        return asdict(self)


@dataclass
class LanguageRecord:
    """One language of the catalogue, keyed on its BCP 47 tag.

    Attributes:
        tag: The BCP 47 tag, for example ``sna`` or ``eng-NG``.
        iso639_3: The bare ISO 639-3 code behind the tag.
        region: ISO 3166-1 alpha-2 region for a country-specific variety, else
            ``None``.
        name: Canonical display name.
        scope: ISO 639-3 scope: ``I`` individual, ``M`` macrolanguage,
            ``S`` special.
        type: ISO 639-3 type, for example ``L`` for a living language.
        aliases: Every catalogue spelling that resolves to this tag.
        slug: The tag lowercased, which is the URL form.
        datasets: Number of catalogue records covering the language.
        hours: Hours across those records, apportioned evenly across each
            record's tags, with unverified figures excluded.
        countries: Country names where the language is recorded, sorted.
        country_codes: The alpha-2 codes of those countries, in the same order.
        tasks: The catalogue tasks attested for this tag, sorted.
    """

    tag: str
    name: str
    slug: str
    iso639_3: str = ""
    region: Optional[str] = None
    scope: str = ""
    type: str = ""
    aliases: List[str] = field(default_factory=list)
    datasets: int = 0
    hours: float = 0.0
    countries: List[str] = field(default_factory=list)
    country_codes: List[str] = field(default_factory=list)
    tasks: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Return the language as a plain JSON-serialisable dict."""
        return asdict(self)
