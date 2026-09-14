"""The ISO 639-3 language registry and the rules that resolve a filter value.

Every ngano language is a BCP 47 tag whose primary subtag is an ISO 639-3
three-letter code. An optional region subtag marks a country-specific variety,
so Nigerian English is ``eng-NG`` and Mozambican Portuguese ``por-MZ``.

The registry is bundled in the wheel as ``language_codes.json``, so resolution
works offline. :func:`resolve_language` implements the same three rules as the
ngano Worker, in the same order, so a filter behaves identically whether it runs
against the bundled snapshot or against ``https://ngano.dev/api/v1``:

1. an exact tag, case insensitively, canonicalised to a lowercase primary
   subtag and an uppercase region, so ``sna``, ``SNA``, ``eng-NG`` and
   ``eng-ng`` all land on the same key;
2. a bare ISO 639-3 code that exists only as regional varieties, which resolves
   to those varieties because there is nothing else it could mean;
3. a name from the registry ``aliases``, case insensitively, in its plain or its
   slugified spelling, which is how an older free-text name still works.

A tag always beats a name. The one collision in the catalogue is ``tem``: it is
the tag for Timne, and ``Tem`` is also the name of ``kdh``. The tag wins, so
``tem`` resolves to Timne.

A bare code never widens to its regional varieties unless ``include_varieties``
is set, in which case the bare tag comes first and every ``<code>-*`` follows.
Input that resolves to nothing yields no tags, so a filter returns nothing
rather than guessing.

Example:
    >>> resolve_language("SNA")
    ['sna']
    >>> resolve_language("isiZulu")
    ['zul']
    >>> resolve_language("tem")
    ['tem']
    >>> resolve_language("Namibian German")
    ['deu-NA']
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple

from .errors import CatalogueError

__all__ = [
    "LanguageCode",
    "LanguageRegistry",
    "canonicalise_tag",
    "default_registry",
    "resolve_language",
    "resolve_languages",
    "slugify_name",
]

#: A three-letter ISO 639-3 primary subtag, optionally followed by a region.
#: The region is an ISO 3166-1 alpha-2 code or a UN M.49 area number, which is
#: what BCP 47 allows.
_TAG_PATTERN = re.compile(r"^([A-Za-z]{3})(?:-([A-Za-z]{2}|[0-9]{3}))?$")

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def canonicalise_tag(value: str) -> Optional[str]:
    """Put a language tag into canonical BCP 47 case.

    The primary subtag is lowercased and the region uppercased, which is the
    case the registry is keyed on, so ``ENG-ng`` finds ``eng-NG``.

    Args:
        value: A candidate tag, with any surrounding whitespace.

    Returns:
        The canonical tag, or ``None`` when the value is not tag shaped. A
        tag shaped value is not necessarily a known one.

    Example:
        >>> canonicalise_tag("ENG-ng"), canonicalise_tag("Shona")
        ('eng-NG', None)
    """
    match = _TAG_PATTERN.match(value.strip())
    if match is None:
        return None
    primary = match.group(1).lower()
    region = match.group(2)
    return f"{primary}-{region.upper()}" if region else primary


def slugify_name(value: str) -> str:
    """Slugify a language name the way the name-based URLs did.

    Accents are stripped and every run of non-alphanumeric characters becomes a
    single hyphen, so ``"Côte d'Ivoire French"`` and ``"cote-d-ivoire-french"``
    compare equal.

    Args:
        value: A language name or any other free text.

    Returns:
        The slug, which is empty when nothing alphanumeric survives.

    Example:
        >>> slugify_name("English (Nigeria)")
        'english-nigeria'
    """
    decomposed = unicodedata.normalize("NFD", value.lower())
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return _NON_ALNUM.sub("-", stripped).strip("-")


@dataclass(frozen=True)
class LanguageCode:
    """One entry of the ISO 639-3 registry bundled with ngano.

    Attributes:
        tag: BCP 47 tag, an ISO 639-3 primary subtag plus an optional region.
        iso639_3: The primary subtag on its own. Several tags can share one.
        region: ISO 3166-1 alpha-2 region, or ``None`` when the tag names the
            language at large rather than a country-specific variety.
        name: Canonical display name, for example ``"English (Nigeria)"``.
        scope: ISO 639-3 scope: ``I`` individual, ``M`` macrolanguage,
            ``S`` special.
        type: ISO 639-3 type: ``L`` living, ``E`` extinct, ``H`` historical,
            ``A`` ancient, ``C`` constructed, ``S`` special.
        aliases: Every catalogue spelling that resolves to this tag.
        resolution: How the tag was arrived at, for example ``iso-registry``,
            ``curated`` or ``group``.

    Example:
        >>> default_registry().get("eng-NG").region
        'NG'
    """

    tag: str
    iso639_3: str
    region: Optional[str] = None
    name: str = ""
    scope: str = ""
    type: str = ""
    aliases: List[str] = field(default_factory=list)
    resolution: str = ""

    @property
    def is_variety(self) -> bool:
        """Whether this tag names a country-specific variety."""
        return self.region is not None

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any]) -> "LanguageCode":
        """Build a registry entry from one ``language_codes.json`` object.

        Args:
            payload: The raw entry.

        Returns:
            The parsed entry.
        """
        tag = str(payload.get("tag", ""))
        aliases = payload.get("aliases") or []
        return cls(
            tag=tag,
            iso639_3=str(payload.get("iso639_3", tag.split("-")[0])),
            region=str(payload["region"]) if payload.get("region") else None,
            name=str(payload.get("name", tag)),
            scope=str(payload.get("scope", "")),
            type=str(payload.get("type", "")),
            aliases=[str(item) for item in aliases],
            resolution=str(payload.get("resolution", "")),
        )

    def to_dict(self) -> Dict[str, Any]:
        """Return the entry as a plain JSON-serialisable dict."""
        return asdict(self)


class LanguageRegistry:
    """The ISO 639-3 registry, with the ngano resolution rules on top.

    Args:
        payload: A parsed ``language_codes.json`` document. Defaults to the
            bundled snapshot.

    Example:
        >>> registry = LanguageRegistry()
        >>> len(registry) > 300
        True
        >>> registry.resolve("eng-ng")
        ['eng-NG']
    """

    def __init__(self, payload: Optional[Mapping[str, Any]] = None) -> None:
        """Index the registry for tag, code and name lookups."""
        if payload is None:
            from .data_files import read_json

            raw = read_json("language_codes.json")
            if not isinstance(raw, Mapping):
                raise CatalogueError("language_codes.json must be a JSON object")
            payload = raw

        codes = payload.get("codes") or {}
        if not isinstance(codes, Mapping):
            raise CatalogueError("language_codes.json must carry a codes object")

        self.version = int(payload.get("version", 1))
        self._codes: Dict[str, LanguageCode] = {}
        for key, entry in codes.items():
            if not isinstance(entry, Mapping):
                continue
            code = LanguageCode.from_dict({**entry, "tag": entry.get("tag", key)})
            self._codes[code.tag] = code

        self._tags_by_code: Dict[str, List[str]] = {}
        for tag, code in self._codes.items():
            self._tags_by_code.setdefault(code.iso639_3, []).append(tag)

        self._tag_by_alias: Dict[str, str] = {}
        for tag, code in self._codes.items():
            self._add_alias(code.name, tag)
            for alias in code.aliases:
                self._add_alias(alias, tag)
        # The source-name index carries spellings the registry entries do not repeat.
        name_to_tag = payload.get("name_to_tag") or {}
        if isinstance(name_to_tag, Mapping):
            for name, tag in name_to_tag.items():
                if tag and str(tag) in self._codes:
                    self._add_alias(str(name), str(tag))

        not_a_language = payload.get("not_a_language") or {}
        self.not_a_language: Dict[str, str] = (
            {str(k): str(v) for k, v in not_a_language.items()}
            if isinstance(not_a_language, Mapping)
            else {}
        )
        descriptive = payload.get("descriptive") or []
        self.descriptive: List[str] = (
            [str(item) for item in descriptive] if isinstance(descriptive, (list, tuple)) else []
        )

    def _add_alias(self, name: str, tag: str) -> None:
        """Index one spelling of a name, in plain and slugified form."""
        lowered = name.strip().lower()
        if not lowered:
            return
        self._tag_by_alias.setdefault(lowered, tag)
        slug = slugify_name(lowered)
        if slug:
            self._tag_by_alias.setdefault(slug, tag)

    # ----------------------------------------------------------------- access

    def __len__(self) -> int:
        """Return how many tags the registry holds."""
        return len(self._codes)

    def __contains__(self, tag: object) -> bool:
        """Whether a canonical tag string is in the registry."""
        return isinstance(tag, str) and tag in self._codes

    def __iter__(self) -> Iterable[LanguageCode]:
        """Iterate over every entry in registry order."""
        return iter(self._codes.values())

    @property
    def codes(self) -> List[LanguageCode]:
        """Every registry entry, in registry order."""
        return list(self._codes.values())

    @property
    def tags(self) -> List[str]:
        """Every known tag, in canonical case and registry order."""
        return list(self._codes)

    def get(self, tag: str) -> Optional[LanguageCode]:
        """Return one entry by tag, in any case.

        Args:
            tag: A tag such as ``"sna"`` or ``"eng-ng"``.

        Returns:
            The entry, or ``None`` when the tag is unknown.
        """
        canonical = canonicalise_tag(tag)
        return self._codes.get(canonical) if canonical else None

    def varieties(self, code: str) -> List[str]:
        """Return every tag sharing one bare ISO 639-3 code.

        Args:
            code: A bare three-letter code such as ``"eng"``.

        Returns:
            The tags, in registry order, including the bare tag when it exists.
        """
        return list(self._tags_by_code.get(code.strip().lower(), ()))

    def name(self, tag: str) -> str:
        """Return the canonical display name for a tag.

        Args:
            tag: A tag such as ``"eng-NG"``.

        Returns:
            The registry name, falling back to the tag itself when unknown.
        """
        entry = self.get(tag)
        return entry.name if entry else tag

    # ------------------------------------------------------------- resolution

    def resolve(self, value: str, include_varieties: bool = False) -> List[str]:
        """Resolve one caller-supplied language to canonical tags.

        The rules are the ones documented at the top of this module, tried in
        order, first match wins.

        Args:
            value: A tag, a bare ISO 639-3 code or a name in any catalogued
                spelling, plain or slugified.
            include_varieties: Widen a bare code to every regional variety of
                it, the bare tag first. Off by default, because a bare code
                means the language at large and must never silently pick up a
                country-specific variety.

        Returns:
            The canonical tags, or an empty list when nothing matches. The
            caller decides whether that is an error or an empty result set.

        Example:
            >>> registry = default_registry()
            >>> registry.resolve("eng", include_varieties=True)[:3]
            ['eng', 'eng-NG', 'eng-ZA']
            >>> registry.resolve("not a language")
            []
        """
        raw = value.strip()
        if not raw:
            return []

        tag = canonicalise_tag(raw)
        if tag is not None:
            varieties = [] if "-" in tag else self.varieties(tag)
            if tag in self._codes:
                if not include_varieties or not varieties:
                    return [tag]
                return [tag] + [other for other in varieties if other != tag]
            if varieties:
                return list(varieties)

        alias = self._tag_by_alias.get(raw.lower()) or self._tag_by_alias.get(slugify_name(raw))
        if alias is None:
            return []
        entry = self._codes.get(alias)
        if include_varieties and entry is not None and entry.region is None:
            varieties = self.varieties(entry.iso639_3)
            if len(varieties) > 1:
                return [alias] + [other for other in varieties if other != alias]
        return [alias]

    def resolve_one(self, value: str) -> Optional[str]:
        """Resolve one value to a single canonical tag.

        Never widens to regional varieties.

        Args:
            value: A tag, a bare code or a name.

        Returns:
            The first canonical tag, or ``None`` when nothing matches.
        """
        tags = self.resolve(value)
        return tags[0] if tags else None

    def resolve_many(
        self, values: Sequence[str], include_varieties: bool = False
    ) -> List[str]:
        """Resolve several values at once, deduplicated, order preserved.

        Args:
            values: The caller's language values.
            include_varieties: Widen each bare code to its regional varieties.

        Returns:
            The canonical tags, in the order they were first reached.
        """
        out: List[str] = []
        seen: Set[str] = set()
        for value in values:
            for tag in self.resolve(str(value), include_varieties):
                if tag in seen:
                    continue
                seen.add(tag)
                out.append(tag)
        return out

    def tags_for(self, values: Iterable[str]) -> Tuple[List[str], List[str]]:
        """Resolve catalogue language spellings to tags and bare codes.

        Used to fill in ``language_tags`` and ``language_codes`` for a payload
        that predates the ISO 639-3 re-key, so an older API response still
        filters correctly.

        Args:
            values: Language names or codes as a source spells them.

        Returns:
            A tuple of the canonical tags and the deduplicated bare codes, both
            in first-seen order.
        """
        tags = self.resolve_many([str(value) for value in values])
        codes: List[str] = []
        for tag in tags:
            entry = self._codes.get(tag)
            code = entry.iso639_3 if entry else tag.split("-")[0]
            if code not in codes:
                codes.append(code)
        return tags, codes


_DEFAULT: Optional[LanguageRegistry] = None


def default_registry() -> LanguageRegistry:
    """Return the process-wide registry built from the bundled snapshot.

    The JSON is parsed once and shared, so resolution costs nothing after the
    first call.

    Returns:
        The shared registry.

    Example:
        >>> default_registry() is default_registry()
        True
    """
    global _DEFAULT
    if _DEFAULT is None:
        _DEFAULT = LanguageRegistry()
    return _DEFAULT


def resolve_language(value: str, include_varieties: bool = False) -> List[str]:
    """Resolve one language value against the bundled registry.

    Args:
        value: A tag, a bare ISO 639-3 code or a name in any catalogued spelling.
        include_varieties: Widen a bare code to every regional variety of it.

    Returns:
        The canonical tags, or an empty list when nothing matches.

    Example:
        >>> resolve_language("Nigerian English")
        ['eng-NG']
    """
    return default_registry().resolve(value, include_varieties)


def resolve_languages(
    values: Sequence[str], include_varieties: bool = False
) -> List[str]:
    """Resolve several language values against the bundled registry.

    Args:
        values: Tags, bare codes or names.
        include_varieties: Widen each bare code to its regional varieties.

    Returns:
        The canonical tags, deduplicated, in first-seen order.

    Example:
        >>> resolve_languages(["sna", "isiZulu", "sna"])
        ['sna', 'zul']
    """
    return default_registry().resolve_many(values, include_varieties)
