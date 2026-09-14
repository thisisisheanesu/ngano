"""The :class:`Filter` builder.

A filter mirrors the query parameters of ``GET https://ngano.dev/api/v1/datasets``.
Values inside one parameter are OR'd, and parameters are AND'd together, exactly
as the HTTP API behaves. The same object can be built from keyword arguments or
fluently, and it can be applied offline to the bundled snapshot or serialised to
query parameters for the live API.

Languages are matched on BCP 47 tags. A ``language`` or ``iso`` value may be a
tag, a bare ISO 639-3 code or any catalogued name, and it is resolved through
the bundled registry before matching, exactly as the API resolves it. See
:mod:`ngano.languages` for the rules.

Example:
    >>> from ngano import Filter
    >>> a = Filter(language="Shona", task="ASR", commercial=True)
    >>> b = Filter().language("Shona").task("ASR").commercial()
    >>> a == b
    True
    >>> Filter(language="isiZulu").resolved_language_tags()
    ['zul']
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple, Union

from .languages import default_registry
from .models import DatasetRecord

__all__ = ["Filter", "COMMERCIAL_YES", "COMMERCIAL_PURCHASABLE"]

#: The catalogue value that means unrestricted commercial use.
COMMERCIAL_YES = "Yes"
#: The catalogue value that means commercial use after a purchase.
COMMERCIAL_PURCHASABLE = "Yes, if purchased"

StrOrStrs = Union[str, Sequence[str], None]

#: Parameters matched by a plain case-insensitive comparison against a record.
_LIST_PARAMS: Tuple[str, ...] = (
    "country",
    "region",
    "task",
    "variety",
    "licence_class",
    "access",
    "labelled",
    "quality",
    "domain",
    "host",
)
#: The two spellings of the language filter. They are OR'd into one set of tags.
_LANGUAGE_PARAMS: Tuple[str, ...] = ("language", "iso")
_BOOL_PARAMS: Tuple[str, ...] = (
    "hf_only",
    "has_hours",
    "include_purchasable",
    "include_varieties",
)
_NUMBER_PARAMS: Tuple[str, ...] = ("min_hours", "max_hours")

#: Record attributes searched by each list parameter.
_FIELD_SOURCES: Dict[str, Tuple[str, ...]] = {
    "country": ("country_codes", "countries"),
    "region": ("regions",),
    "task": ("task",),
    "variety": ("variety",),
    "licence_class": ("licence_class",),
    "access": ("access",),
    "labelled": ("labelled",),
    "quality": ("quality",),
    "domain": ("domain",),
    "host": ("host",),
}

_Q_FIELDS = ("id", "name", "notes", "domain", "host", "licence", "hf_repo")


def _split(value: StrOrStrs) -> Optional[List[str]]:
    """Normalise a repeatable parameter to a list of non-empty strings."""
    if value is None:
        return None
    if isinstance(value, str):
        items = [part.strip() for part in value.split(",")]
    else:
        items = []
        for entry in value:
            items.extend(part.strip() for part in str(entry).split(","))
    cleaned = [item for item in items if item]
    return cleaned or None


def _record_values(record: DatasetRecord, attrs: Sequence[str]) -> List[str]:
    """Collect the comparable string values of a record for some attributes."""
    out: List[str] = []
    for attr in attrs:
        value = getattr(record, attr, None)
        if value is None:
            continue
        if isinstance(value, str):
            out.append(value)
        elif isinstance(value, Iterable):
            out.extend(str(item) for item in value)
        else:
            out.append(str(value))
    return out


class Filter:
    """A catalogue query, buildable by keyword argument or fluently.

    Args:
        q: Free-text search over id, name, notes, domain, host, licence and repo.
        language: One or more languages, each a BCP 47 tag such as ``sna`` or
            ``eng-NG``, a bare ISO 639-3 code, or any catalogued name such as
            ``isiZulu``. Values are resolved to canonical tags before matching,
            and a value that resolves to nothing matches nothing.
        iso: The same filter as ``language``, spelled as codes. Both are OR'd
            into one set of tags.
        include_varieties: Widen a bare ISO 639-3 code to every regional variety
            of it, so ``language="eng"`` also matches ``eng-NG`` and ``eng-ZA``.
        country: ISO 3166-1 alpha-2 code or country name.
        region: Region name, for example ``"East Africa"``.
        task: ``ASR``, ``TTS``, ``ASR+TTS``, ``Raw source`` or ``Other``.
        variety: Variety label, for example ``"Indigenous"``.
        commercial: ``True`` for commercially usable datasets, or an explicit
            catalogue value such as ``"Unstated"``. ``True`` means
            ``commercial == "Yes"``; pass ``include_purchasable=True`` to also
            accept ``"Yes, if purchased"``.
        include_purchasable: Widen ``commercial=True`` to include datasets that
            allow commercial use after purchase.
        licence_class: Licence class string, for example ``"Attribution (CC-BY)"``.
        access: ``Open``, ``Request``, ``Paid``, ``Scrape required`` or ``Unclear``.
        labelled: ``Transcribed``, ``Unlabelled`` or ``Unstated``.
        quality: Quality band string.
        domain: Domain string.
        host: Host string, for example ``"HuggingFace"``.
        hf_only: Keep only records with a Hugging Face repo, the only ones that
            can be streamed.
        min_hours: Minimum published hours.
        max_hours: Maximum published hours.
        has_hours: Keep only records with a published hours figure.
        sort: ``hours``, ``name`` or ``year``, optionally prefixed with ``-``
            for descending order.

    Example:
        >>> Filter(language=["sna", "nde"], hf_only=True).to_params()["language"]
        'sna,nde'
    """

    __slots__ = ("_params",)

    def __init__(
        self,
        q: Optional[str] = None,
        language: StrOrStrs = None,
        iso: StrOrStrs = None,
        country: StrOrStrs = None,
        region: StrOrStrs = None,
        task: StrOrStrs = None,
        variety: StrOrStrs = None,
        commercial: Union[bool, str, Sequence[str], None] = None,
        include_purchasable: bool = False,
        include_varieties: bool = False,
        licence_class: StrOrStrs = None,
        access: StrOrStrs = None,
        labelled: StrOrStrs = None,
        quality: StrOrStrs = None,
        domain: StrOrStrs = None,
        host: StrOrStrs = None,
        hf_only: bool = False,
        min_hours: Optional[float] = None,
        max_hours: Optional[float] = None,
        has_hours: bool = False,
        sort: Optional[str] = None,
    ) -> None:
        """Build a filter from keyword arguments."""
        params: Dict[str, Any] = {}
        for name, value in (
            ("language", language),
            ("iso", iso),
            ("country", country),
            ("region", region),
            ("task", task),
            ("variety", variety),
            ("licence_class", licence_class),
            ("access", access),
            ("labelled", labelled),
            ("quality", quality),
            ("domain", domain),
            ("host", host),
        ):
            parsed = _split(value)
            if parsed:
                params[name] = parsed
        if q:
            params["q"] = q
        if commercial is not None:
            params["commercial"] = commercial
        if include_purchasable:
            params["include_purchasable"] = True
        if include_varieties:
            params["include_varieties"] = True
        if hf_only:
            params["hf_only"] = True
        if has_hours:
            params["has_hours"] = True
        if min_hours is not None:
            params["min_hours"] = float(min_hours)
        if max_hours is not None:
            params["max_hours"] = float(max_hours)
        if sort:
            params["sort"] = sort
        self._params: Dict[str, Any] = params

    # ---------------------------------------------------------------- basics

    @property
    def params(self) -> Dict[str, Any]:
        """A copy of the raw parameter mapping."""
        return dict(self._params)

    def get(self, name: str, default: Any = None) -> Any:
        """Return one parameter value.

        Args:
            name: Parameter name, for example ``"language"``.
            default: Value returned when the parameter is unset.

        Returns:
            The stored value, or ``default``.
        """
        return self._params.get(name, default)

    def is_empty(self) -> bool:
        """Whether the filter would keep every record."""
        return not self._params

    def _with(self, **updates: Any) -> "Filter":
        """Return a copy with some parameters replaced."""
        clone = Filter()
        merged = dict(self._params)
        for key, value in updates.items():
            if value is None:
                merged.pop(key, None)
            else:
                merged[key] = value
        clone._params = merged
        return clone

    def merge(self, other: "Filter") -> "Filter":
        """Return a filter combining this one with another.

        Args:
            other: The filter whose parameters win on conflict.

        Returns:
            A new filter.
        """
        return self._with(**other.params)

    def __eq__(self, other: object) -> bool:
        """Compare two filters by their parameters."""
        if not isinstance(other, Filter):
            return NotImplemented
        return self._params == other._params

    def __hash__(self) -> int:
        """Hash the filter by its serialised parameters."""
        return hash(tuple(sorted((k, str(v)) for k, v in self._params.items())))

    def __repr__(self) -> str:
        """Return a readable constructor-like representation."""
        inner = ", ".join(f"{k}={v!r}" for k, v in sorted(self._params.items()))
        return f"Filter({inner})"

    # ---------------------------------------------------------------- fluent

    def q(self, value: str) -> "Filter":
        """Return a copy with the free-text query set."""
        return self._with(q=value)

    def language(self, *values: str) -> "Filter":
        """Return a copy filtered to these languages.

        Args:
            *values: Tags, bare ISO 639-3 codes or catalogued names, in any
                mixture. They are resolved to canonical tags when the filter
                runs, so ``"sna"``, ``"SNA"`` and ``"Shona"`` are equivalent.

        Returns:
            A new filter.
        """
        return self._with(language=_split(list(values)))

    def iso(self, *values: str) -> "Filter":
        """Return a copy filtered to these ISO 639-3 codes.

        This is the code-shaped spelling of :meth:`language`. Both are OR'd into
        one set of tags, so setting each of them widens rather than narrows.

        Args:
            *values: Bare codes such as ``"sna"``, or tags such as ``"eng-NG"``.

        Returns:
            A new filter.
        """
        return self._with(iso=_split(list(values)))

    def include_varieties(self, value: bool = True) -> "Filter":
        """Return a copy that widens a bare code to its regional varieties.

        Args:
            value: ``True`` to let ``eng`` also match ``eng-NG`` and the rest.

        Returns:
            A new filter.
        """
        return self._with(include_varieties=value or None)

    def resolved_language_tags(self) -> List[str]:
        """Return the canonical tags this filter's language values resolve to.

        Returns:
            The tags, deduplicated and in first-seen order. Empty when the
            filter sets no language, and also empty when every value given was
            unresolvable, in which case the filter matches no record.

        Example:
            >>> Filter(iso="eng", include_varieties=True).resolved_language_tags()[:2]
            ['eng', 'eng-NG']
        """
        requested = self._requested_languages()
        if not requested:
            return []
        return default_registry().resolve_many(
            requested, bool(self._params.get("include_varieties"))
        )

    def country(self, *values: str) -> "Filter":
        """Return a copy filtered to these countries, by alpha-2 code or name."""
        return self._with(country=_split(list(values)))

    def region(self, *values: str) -> "Filter":
        """Return a copy filtered to these regions."""
        return self._with(region=_split(list(values)))

    def task(self, *values: str) -> "Filter":
        """Return a copy filtered to these tasks."""
        return self._with(task=_split(list(values)))

    def variety(self, *values: str) -> "Filter":
        """Return a copy filtered to these varieties."""
        return self._with(variety=_split(list(values)))

    def commercial(
        self, value: Union[bool, str, Sequence[str]] = True, include_purchasable: bool = False
    ) -> "Filter":
        """Return a copy filtered by commercial usability.

        Args:
            value: ``True`` for ``"Yes"`` only, ``False`` for anything that is
                not ``"Yes"``, or an explicit catalogue value.
            include_purchasable: Also accept ``"Yes, if purchased"``.

        Returns:
            A new filter.
        """
        updates: Dict[str, Any] = {"commercial": value}
        if include_purchasable:
            updates["include_purchasable"] = True
        return self._with(**updates)

    def licence_class(self, *values: str) -> "Filter":
        """Return a copy filtered to these licence classes."""
        return self._with(licence_class=_split(list(values)))

    def access(self, *values: str) -> "Filter":
        """Return a copy filtered to these access modes."""
        return self._with(access=_split(list(values)))

    def labelled(self, *values: str) -> "Filter":
        """Return a copy filtered to these labelling states."""
        return self._with(labelled=_split(list(values)))

    def quality(self, *values: str) -> "Filter":
        """Return a copy filtered to these quality bands."""
        return self._with(quality=_split(list(values)))

    def domain(self, *values: str) -> "Filter":
        """Return a copy filtered to these domains."""
        return self._with(domain=_split(list(values)))

    def host(self, *values: str) -> "Filter":
        """Return a copy filtered to these hosts."""
        return self._with(host=_split(list(values)))

    def hf_only(self, value: bool = True) -> "Filter":
        """Return a copy keeping only records with a Hugging Face repo."""
        return self._with(hf_only=value or None)

    def min_hours(self, value: float) -> "Filter":
        """Return a copy with a minimum published hours bound."""
        return self._with(min_hours=float(value))

    def max_hours(self, value: float) -> "Filter":
        """Return a copy with a maximum published hours bound."""
        return self._with(max_hours=float(value))

    def has_hours(self, value: bool = True) -> "Filter":
        """Return a copy keeping only records with a published hours figure."""
        return self._with(has_hours=value or None)

    def sort(self, value: str) -> "Filter":
        """Return a copy with a sort key, for example ``"-hours"``."""
        return self._with(sort=value)

    # --------------------------------------------------------------- matching

    def _commercial_allowed(self) -> Optional[List[str]]:
        """Return the accepted ``commercial`` values, or ``None`` for any."""
        value = self._params.get("commercial")
        if value is None:
            return None
        if value is True:
            allowed = [COMMERCIAL_YES]
            if self._params.get("include_purchasable"):
                allowed.append(COMMERCIAL_PURCHASABLE)
            return allowed
        if value is False:
            return []
        parsed = _split(value if isinstance(value, (list, tuple)) else str(value))
        return parsed or None

    def _requested_languages(self) -> List[str]:
        """Return the raw ``language`` and ``iso`` values, in that order."""
        out: List[str] = []
        for name in _LANGUAGE_PARAMS:
            out.extend(str(item) for item in self._params.get(name) or ())
        return out

    def matches(self, record: DatasetRecord) -> bool:
        """Whether one catalogue record satisfies this filter.

        Args:
            record: The record to test.

        Returns:
            True when every set parameter matches.
        """
        params = self._params

        if self._requested_languages():
            tags = {tag.casefold() for tag in self.resolved_language_tags()}
            if not tags:
                return False
            if not any(str(tag).casefold() in tags for tag in record.language_tags):
                return False

        for name in _LIST_PARAMS:
            wanted = params.get(name)
            if not wanted:
                continue
            haystack = {v.casefold() for v in _record_values(record, _FIELD_SOURCES[name])}
            if not any(str(item).casefold() in haystack for item in wanted):
                return False

        commercial = params.get("commercial")
        if commercial is not None:
            allowed = self._commercial_allowed()
            current = (record.commercial or "").casefold()
            if commercial is False:
                if current == COMMERCIAL_YES.casefold():
                    return False
            elif allowed is not None:
                if current not in {value.casefold() for value in allowed}:
                    return False

        if params.get("hf_only") and not record.hf_repo:
            return False

        if params.get("has_hours") and record.hours_num is None:
            return False

        hours = record.hours_num
        min_hours = params.get("min_hours")
        if min_hours is not None and (hours is None or hours < min_hours):
            return False
        max_hours = params.get("max_hours")
        if max_hours is not None and (hours is None or hours > max_hours):
            return False

        query = params.get("q")
        if query:
            needle = str(query).casefold()
            hay = " ".join(_record_values(record, _Q_FIELDS))
            hay += " " + " ".join(
                _record_values(record, ("languages", "languages_clean", "countries", "regions"))
            )
            if needle not in hay.casefold():
                return False

        return True

    def apply(self, records: Iterable[DatasetRecord]) -> List[DatasetRecord]:
        """Filter and sort a sequence of records.

        Args:
            records: Catalogue records to filter.

        Returns:
            The matching records, sorted when ``sort`` is set.
        """
        selected = [record for record in records if self.matches(record)]
        sort = self._params.get("sort")
        if sort:
            key = str(sort)
            reverse = key.startswith("-")
            key = key.lstrip("-")
            if key == "hours":
                selected.sort(key=lambda r: r.hours_num or 0.0, reverse=reverse)
            elif key == "name":
                selected.sort(key=lambda r: r.name.casefold(), reverse=reverse)
            elif key == "year":
                selected.sort(key=lambda r: str(r.year or ""), reverse=reverse)
        return selected

    def to_params(self) -> Dict[str, str]:
        """Serialise the filter as HTTP query parameters.

        Repeatable parameters are comma joined, matching the ngano API, which
        accepts comma-separated values as an alternative to repeated keys.

        Returns:
            A mapping suitable for ``requests.get(..., params=...)``.
        """
        out: Dict[str, str] = {}
        for name, value in self._params.items():
            if name == "include_purchasable":
                continue
            if name == "commercial":
                allowed = self._commercial_allowed()
                if value is False:
                    out["commercial"] = "No,Unstated"
                elif allowed:
                    out["commercial"] = ",".join(allowed)
                continue
            if isinstance(value, bool):
                out[name] = "true" if value else "false"
            elif isinstance(value, (list, tuple)):
                out[name] = ",".join(str(item) for item in value)
            else:
                out[name] = str(value)
        return out

    @classmethod
    def from_mapping(cls, payload: Mapping[str, Any]) -> "Filter":
        """Build a filter from a mapping of keyword arguments.

        Unknown keys are ignored, so a request dict can be passed straight in.

        Args:
            payload: Keyword arguments by name.

        Returns:
            The filter.
        """
        allowed = set(_LIST_PARAMS) | set(_LANGUAGE_PARAMS) | set(_BOOL_PARAMS)
        allowed |= set(_NUMBER_PARAMS)
        allowed |= {"q", "commercial", "sort"}
        kwargs = {key: value for key, value in payload.items() if key in allowed}
        return cls(**kwargs)
