"""Column mapping from arbitrary dataset schemas onto the canonical ngano row.

The rules live in ``data/field_map.json`` and are applied in one fixed order,
identical in every ngano SDK:

1. ``overrides[hf_repo]``, when the repo has a hand-checked entry.
2. runtime inspection of the dataset's real columns against ``aliases``,
   matching case-insensitively and ignoring underscores and hyphens.
3. ``unit_hints`` conversions, for example ``duration_ms`` to ``duration_s``.
4. anything still unmapped is preserved under :attr:`ngano.Row.extra`.
5. columns listed in ``drop`` are discarded rather than kept as extras.

An unknown schema never raises. ``transcript`` and ``audio`` are simply left as
``None`` and the reason is recorded in ``Row.extra["_ngano_unmapped"]``.

The row's language is settled after mapping, by
:func:`_resolve_row_language`: the row's own tag, code or language value decides
it where one of them resolves to exactly one BCP 47 tag, and the catalogue record
decides it only when that record names exactly one language.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Sequence, Set, Tuple

from .errors import CatalogueError
from .models import AudioRef, Row

__all__ = ["FieldMap", "ColumnPlan", "normalise_column", "build_row"]

#: Canonical row fields that can be filled from a source column.
COLUMN_FIELDS: Tuple[str, ...] = (
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
)

_FLOAT_FIELDS = frozenset({"duration_s"})
_INT_FIELDS = frozenset({"sampling_rate"})


def normalise_column(name: str) -> str:
    """Normalise a column name for matching.

    Lowercases the name and removes underscores, hyphens and spaces, so
    ``"Client_ID"``, ``"client-id"`` and ``"clientid"`` all compare equal.

    Args:
        name: A raw column name.

    Returns:
        The normalised key.

    Example:
        >>> normalise_column("WAV_PATH")
        'wavpath'
    """
    return name.lower().replace("_", "").replace("-", "").replace(" ", "")


@dataclass(frozen=True)
class ColumnPlan:
    """How one dataset's columns map onto the canonical row.

    A plan is computed once per dataset from its column names, then reused for
    every row, so mapping costs nothing per row beyond the lookups.

    Attributes:
        mapping: Canonical field name to source column name.
        conversions: Canonical field name to a source column and the multiplier
            that converts its unit, from ``unit_hints``.
        dropped: Source columns discarded because they are in the ``drop`` list.
        extras: Source columns kept verbatim under ``Row.extra``.
        unmapped: A human readable reason when ``transcript`` or ``audio`` could
            not be identified, else ``None``.
        hf_repo: The repo the plan was built for, when known.
        used_override: Whether a hand-checked repo override contributed.
    """

    mapping: Dict[str, str] = field(default_factory=dict)
    conversions: Dict[str, Tuple[str, float]] = field(default_factory=dict)
    dropped: Tuple[str, ...] = ()
    extras: Tuple[str, ...] = ()
    unmapped: Optional[str] = None
    hf_repo: Optional[str] = None
    used_override: bool = False

    def source_column(self, canonical: str) -> Optional[str]:
        """Return the source column feeding a canonical field, if any.

        Args:
            canonical: A canonical field name, for example ``"transcript"``.

        Returns:
            The source column name, or ``None`` when the field is unmapped.
        """
        if canonical in self.mapping:
            return self.mapping[canonical]
        if canonical in self.conversions:
            return self.conversions[canonical][0]
        return None


@dataclass(frozen=True)
class FieldMap:
    """The parsed contents of ``field_map.json``.

    Example:
        >>> fm = FieldMap.default()
        >>> plan = fm.plan(["sentence", "audio", "locale", "up_votes"])
        >>> plan.mapping["transcript"], plan.dropped
        ('sentence', ('up_votes',))
    """

    aliases: Dict[str, List[str]] = field(default_factory=dict)
    drop: Tuple[str, ...] = ()
    unit_hints: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    overrides: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    canonical: Dict[str, str] = field(default_factory=dict)
    version: int = 1

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "FieldMap":
        """Build a field map from a parsed ``field_map.json`` document.

        Args:
            payload: The JSON object, as returned by ``GET /api/v1/schema``.

        Returns:
            The parsed field map.
        """
        aliases = {
            str(key): [str(item) for item in value]
            for key, value in dict(payload.get("aliases", {})).items()
        }
        return cls(
            aliases=aliases,
            drop=tuple(str(item) for item in payload.get("drop", [])),
            unit_hints=dict(payload.get("unit_hints", {})),
            overrides=dict(payload.get("overrides", {})),
            canonical=dict(payload.get("canonical", {})),
            version=int(payload.get("version", 1)),
        )

    @classmethod
    def default(cls) -> "FieldMap":
        """Load the field map bundled with the installed package.

        Returns:
            The field map from the offline snapshot.
        """
        from .data_files import read_json

        payload = read_json("field_map.json")
        if not isinstance(payload, dict):
            raise CatalogueError("field_map.json must be a JSON object")
        return cls.from_dict(payload)

    def plan(
        self, columns: Sequence[str], hf_repo: Optional[str] = None
    ) -> ColumnPlan:
        """Work out how a dataset's columns map onto the canonical row.

        Args:
            columns: The dataset's real column names, from its features or from
                the keys of its first row.
            hf_repo: The Hugging Face repo id, used to look up an override.

        Returns:
            A :class:`ColumnPlan`. It is always returned, never an exception,
            even when nothing could be mapped.

        Example:
            >>> plan = FieldMap.default().plan(["Text", "Speaker-Name"])
            >>> plan.mapping["transcript"], plan.mapping["speaker_id"]
            ('Text', 'Speaker-Name')
        """
        by_norm: Dict[str, str] = {}
        for column in columns:
            by_norm.setdefault(normalise_column(column), column)

        mapping: Dict[str, str] = {}
        conversions: Dict[str, Tuple[str, float]] = {}
        used: Set[str] = set()
        used_override = False

        # Step 1: repo overrides.
        override = self.overrides.get(hf_repo or "", {})
        for canonical, source in override.items():
            if canonical not in COLUMN_FIELDS or not isinstance(source, str):
                continue
            actual = by_norm.get(normalise_column(source))
            if actual is not None and actual not in used:
                mapping[canonical] = actual
                used.add(actual)
                used_override = True

        # Step 2: alias matching against the real columns.
        hint_matches: Dict[str, str] = {}
        for target, alias_list in self.aliases.items():
            is_unit_source = target in self.unit_hints
            if not is_unit_source and target not in COLUMN_FIELDS:
                continue
            if target in mapping:
                continue
            for alias in alias_list:
                actual = by_norm.get(normalise_column(alias))
                if actual is None or actual in used:
                    continue
                if is_unit_source:
                    hint_matches[target] = actual
                else:
                    mapping[target] = actual
                used.add(actual)
                break

        # Step 3: unit hint conversions.
        for hint_name, hint in self.unit_hints.items():
            target = str(hint.get("canonical", ""))
            if not target or target in mapping or target in conversions:
                continue
            source = hint_matches.get(hint_name)
            if source is None:
                candidate = by_norm.get(normalise_column(hint_name))
                if candidate is not None and candidate not in used:
                    source = candidate
                    used.add(candidate)
            if source is None:
                continue
            try:
                multiplier = float(hint.get("multiply", 1.0))
            except (TypeError, ValueError):
                multiplier = 1.0
            conversions[target] = (source, multiplier)

        # Step 5: discard the drop list, then keep everything else as extras.
        drop_norms = {normalise_column(item) for item in self.drop}
        dropped: List[str] = []
        extras: List[str] = []
        for column in columns:
            if column in used:
                continue
            if normalise_column(column) in drop_norms:
                dropped.append(column)
            else:
                extras.append(column)

        unmapped: Optional[str] = None
        missing = [f for f in ("transcript", "audio") if f not in mapping]
        if missing:
            unmapped = (
                "could not identify "
                + " or ".join(missing)
                + " in columns: "
                + ", ".join(sorted(columns))
            )

        return ColumnPlan(
            mapping=mapping,
            conversions=conversions,
            dropped=tuple(dropped),
            extras=tuple(extras),
            unmapped=unmapped,
            hf_repo=hf_repo,
            used_override=used_override,
        )


def _coerce(canonical: str, value: Any) -> Any:
    """Coerce a raw source value to the canonical field's type."""
    if value is None:
        return None
    if canonical in _FLOAT_FIELDS:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    if canonical in _INT_FIELDS:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None
    if isinstance(value, str):
        return value
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return str(value)


def build_audio_ref(value: Any, token: Optional[str] = None) -> Optional[AudioRef]:
    """Build a lazy :class:`~ngano.AudioRef` from a raw source value.

    Handles the shapes Hugging Face datasets produce: the ``{"path", "bytes",
    "sampling_rate"}`` mapping, a bare path or URL string, and decoder objects
    that expose ``path`` or ``sample_rate`` attributes. Nothing is read.

    Args:
        value: The raw value of the mapped audio column.
        token: Hugging Face token to attach for later authenticated fetches.

    Returns:
        An audio handle, or ``None`` when the value carries no usable locator.

    Example:
        >>> build_audio_ref({"path": "a.wav", "sampling_rate": 16000}).sampling_rate
        16000
    """
    if value is None:
        return None
    if isinstance(value, AudioRef):
        return value
    if isinstance(value, str):
        return AudioRef(path=value, token=token)
    if isinstance(value, (bytes, bytearray)):
        return AudioRef(bytes=bytes(value), token=token)
    if isinstance(value, Mapping):
        raw_rate = value.get("sampling_rate", value.get("sample_rate"))
        rate: Optional[int]
        try:
            rate = int(raw_rate) if raw_rate is not None else None
        except (TypeError, ValueError):
            rate = None
        payload = value.get("bytes")
        path = value.get("path")
        url = value.get("url")
        if path is None and url is None and payload is None:
            return None
        return AudioRef(
            url=str(url) if url else None,
            path=str(path) if path else None,
            sampling_rate=rate,
            bytes=bytes(payload) if isinstance(payload, (bytes, bytearray)) else None,
            token=token,
        )
    path_attr = getattr(value, "path", None)
    rate_attr = getattr(value, "sample_rate", getattr(value, "sampling_rate", None))
    if path_attr or rate_attr:
        try:
            rate = int(rate_attr) if rate_attr is not None else None
        except (TypeError, ValueError):
            rate = None
        return AudioRef(path=str(path_attr) if path_attr else None, sampling_rate=rate, token=token)
    return None


def _resolve_row_language(
    stated_tag: Optional[str],
    stated_iso: Optional[str],
    stated_language: Optional[str],
    record_tag: Optional[str],
    record_iso: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    """Work out one row's language tag and bare ISO 639-3 code.

    The rule is the same in every ngano SDK. The tag is:

    1. the row's own ``language_tag``, ``language_iso`` or ``language`` value,
       in that order, taking the first that resolves to exactly one tag;
    2. otherwise the catalogue record's tag, but only when the record names
       exactly one language, since a row from a forty language corpus cannot be
       attributed to one language just because the record lists it first;
    3. otherwise ``None``.

    The code is the bare primary subtag of a tag resolved from the row itself,
    otherwise the row's own stated code kept verbatim when that code resolves to
    nothing, so an ISO 639-1 ``sw`` survives as ``"sw"``, otherwise the record's
    single bare code.

    Args:
        stated_tag: The row's own ``language_tag`` column value, if mapped.
        stated_iso: The row's own ``language_iso`` column value, if mapped.
        stated_language: The row's own ``language`` column value, if mapped.
        record_tag: The catalogue record's tag when it names exactly one
            language, else ``None``.
        record_iso: The catalogue record's bare code when it names exactly one,
            else ``None``.

    Returns:
        A tuple of the row's tag and its bare code, either of which may be
        ``None``.

    Example:
        >>> _resolve_row_language("eng-ng", None, None, "sna", "sna")
        ('eng-NG', 'eng')
        >>> _resolve_row_language(None, "sw", None, None, None)
        (None, 'sw')
    """
    from .languages import default_registry

    registry = default_registry()
    row_tag: Optional[str] = None
    for candidate in (stated_tag, stated_iso, stated_language):
        if not candidate:
            continue
        resolved = registry.resolve(str(candidate))
        if len(resolved) == 1:
            row_tag = resolved[0]
            break

    if row_tag is not None:
        return row_tag, row_tag.split("-")[0]
    if stated_iso and not registry.resolve(str(stated_iso)):
        # The source states a code ngano cannot place, an ISO 639-1 code for
        # example. It is reported as the source wrote it, never rewritten.
        return record_tag, str(stated_iso)
    return record_tag, record_iso


def build_row(
    raw: Mapping[str, Any],
    plan: ColumnPlan,
    *,
    split: str = "train",
    dataset_id: Optional[str] = None,
    hf_repo: Optional[str] = None,
    licence: Optional[str] = None,
    source_url: Optional[str] = None,
    country: Optional[str] = None,
    language: Optional[str] = None,
    language_iso: Optional[str] = None,
    language_tag: Optional[str] = None,
    domain: Optional[str] = None,
    token: Optional[str] = None,
) -> Row:
    """Turn one raw source row into a canonical :class:`~ngano.Row`.

    Catalogue values are used as fallbacks only. A value present in the source
    row always wins, because the source knows its own utterance best.

    Args:
        raw: The source row as a mapping of column name to value.
        plan: The :class:`ColumnPlan` computed for this dataset.
        split: Split name to record on the row.
        dataset_id: ngano catalogue id.
        hf_repo: Hugging Face repo id.
        licence: Licence string from the catalogue.
        source_url: Canonical dataset URL.
        country: Catalogue country fallback, ISO 3166-1 alpha-2.
        language: Catalogue language name fallback, the canonical name of the
            record's single tag.
        language_iso: The record's single bare ISO 639-3 code, or ``None`` when
            the record names several languages.
        language_tag: The record's single BCP 47 tag, or ``None`` when the
            record names zero or several languages. It is used only when the
            row itself says nothing, since a row from a forty language corpus
            cannot be attributed to one language just because the record lists
            that language first.
        domain: Catalogue domain fallback.
        token: Hugging Face token to attach to the audio handle.

    Returns:
        The canonical row. Unmapped columns are under ``row.extra``.
    """
    values: Dict[str, Any] = {}
    for canonical, column in plan.mapping.items():
        if canonical == "audio":
            continue
        values[canonical] = _coerce(canonical, raw.get(column))
    for canonical, (column, multiplier) in plan.conversions.items():
        if values.get(canonical) is not None:
            continue
        raw_value = raw.get(column)
        if raw_value is None:
            continue
        try:
            values[canonical] = float(raw_value) * multiplier
        except (TypeError, ValueError):
            continue

    audio: Optional[AudioRef] = None
    audio_column = plan.mapping.get("audio")
    if audio_column is not None:
        audio = build_audio_ref(raw.get(audio_column), token=token)

    sampling_rate = values.get("sampling_rate")
    if audio is not None:
        if audio.sampling_rate is None and sampling_rate is not None:
            audio.sampling_rate = int(sampling_rate)
        elif audio.sampling_rate is not None and sampling_rate is None:
            sampling_rate = audio.sampling_rate

    row_tag, row_iso = _resolve_row_language(
        stated_tag=values.get("language_tag"),
        stated_iso=values.get("language_iso"),
        stated_language=values.get("language"),
        record_tag=language_tag,
        record_iso=language_iso,
    )

    extra: Dict[str, Any] = {column: raw.get(column) for column in plan.extras if column in raw}
    for column in raw:
        if (
            column not in extra
            and column not in plan.mapping.values()
            and column not in {src for src, _ in plan.conversions.values()}
            and column not in plan.dropped
        ):
            extra[column] = raw[column]
    if plan.unmapped:
        extra["_ngano_unmapped"] = plan.unmapped

    return Row(
        audio=audio,
        transcript=values.get("transcript"),
        language=values.get("language") or language,
        language_iso=row_iso,
        language_tag=row_tag,
        country=values.get("country") or country,
        speaker_id=values.get("speaker_id"),
        gender=values.get("gender"),
        age=values.get("age"),
        duration_s=values.get("duration_s"),
        sampling_rate=int(sampling_rate) if sampling_rate is not None else None,
        domain=values.get("domain") or domain,
        split=str(values.get("split") or split),
        dataset_id=dataset_id,
        hf_repo=hf_repo,
        licence=licence,
        source_url=source_url,
        extra=extra,
    )
