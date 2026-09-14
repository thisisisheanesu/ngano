"""The ngano catalogue: 612 African-language speech dataset records.

Languages are keyed on BCP 47 tags whose primary subtag is an ISO 639-3 code,
so Shona is ``sna`` and Nigerian English is ``eng-NG``. Filters, records and
language lookups all work in tags, and any catalogued name or bare code is
resolved to one first. See :mod:`ngano.languages` for the resolution rules.

:class:`Catalogue` reads the snapshot bundled in the wheel, so it works with no
network access and no Hugging Face token. :meth:`Catalogue.from_api` reads the
same data live from ``https://ngano.dev/api/v1`` when you want the newest
records.

Figures are reproduced as each source published them. Self-reported claims of
20,000 hours or more are flagged ``unverified_size`` in the catalogue and are
excluded from every hours total computed here.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Dict, Iterator, List, Mapping, Optional, Sequence, Set, Tuple

from .data_files import read_json
from .errors import CatalogueError, DatasetNotFoundError
from .filters import Filter
from .languages import LanguageCode, LanguageRegistry, default_registry
from .mapping import FieldMap
from .models import CountryRecord, DatasetRecord, LanguageRecord

__all__ = ["Catalogue", "DEFAULT_API_BASE"]

#: Base URL of the public ngano HTTP API.
DEFAULT_API_BASE = "https://ngano.dev/api/v1"

_FACETS: Tuple[str, ...] = (
    "task",
    "variety",
    "commercial",
    "access",
    "labelled",
    "quality",
    "licence_class",
    "host",
)


def _as_objects(payload: Any) -> List[Dict[str, Any]]:
    """Coerce a JSON array of objects to a list of plain dicts.

    Args:
        payload: A parsed JSON array.

    Returns:
        One dict per object entry, skipping anything that is not an object.
    """
    if not isinstance(payload, (list, tuple)):
        return []
    return [dict(item) for item in payload if isinstance(item, Mapping)]


class Catalogue:
    """An in-memory view of the ngano dataset catalogue.

    Args:
        records: Dataset records. Defaults to the bundled snapshot.
        countries: Raw country entries. Defaults to the bundled snapshot.
        languages: Raw language entries. Defaults to the bundled snapshot.
        field_map: Column mapping rules. Defaults to the bundled snapshot.
        source: Where this catalogue came from, ``"bundled"`` or an API base URL.
        language_codes: A parsed ``language_codes.json`` registry. Defaults to
            the bundled one, which is what language resolution uses.

    Example:
        >>> cat = Catalogue()
        >>> len(cat) > 0
        True
        >>> cat.get("waxal-corpus-paper").name
        'WAXAL corpus paper'
    """

    def __init__(
        self,
        records: Optional[Sequence[Mapping[str, Any]]] = None,
        countries: Optional[Sequence[Mapping[str, Any]]] = None,
        languages: Optional[Sequence[Mapping[str, Any]]] = None,
        field_map: Optional[Mapping[str, Any]] = None,
        source: str = "bundled",
        language_codes: Optional[Mapping[str, Any]] = None,
    ) -> None:
        """Load the catalogue, defaulting to the offline bundled snapshot."""
        raw_records = records if records is not None else read_json("catalogue.json")
        raw_countries = countries if countries is not None else read_json("countries.json")
        raw_languages = languages if languages is not None else read_json("languages.json")
        raw_field_map = field_map if field_map is not None else read_json("field_map.json")

        if not isinstance(raw_records, (list, tuple)):
            raise CatalogueError("the catalogue payload must be a list of dataset objects")

        self._records: List[DatasetRecord] = [
            DatasetRecord.from_dict(item) for item in raw_records
        ]
        self._raw_countries: List[Dict[str, Any]] = _as_objects(raw_countries)
        self._raw_languages: List[Dict[str, Any]] = _as_objects(raw_languages)
        self._field_map = FieldMap.from_dict(dict(raw_field_map))
        self._registry = (
            LanguageRegistry(language_codes)
            if language_codes is not None
            else default_registry()
        )
        self.source = source

        self._by_id: Dict[str, DatasetRecord] = {r.id: r for r in self._records}
        self._by_repo: Dict[str, DatasetRecord] = {}
        for record in self._records:
            if record.hf_repo:
                self._by_repo.setdefault(record.hf_repo.casefold(), record)

    # ------------------------------------------------------------- factories

    @classmethod
    def from_api(
        cls,
        base_url: str = DEFAULT_API_BASE,
        timeout: float = 30.0,
        session: Optional[Any] = None,
        per_page: int = 200,
    ) -> "Catalogue":
        """Load the catalogue live from the ngano HTTP API.

        The API is public and unauthenticated. Every page of ``/datasets`` is
        fetched, together with ``/countries``, ``/languages`` and ``/schema``.

        Args:
            base_url: API base, defaulting to ``https://ngano.dev/api/v1``.
            timeout: Per-request timeout in seconds.
            session: An optional ``requests.Session`` to reuse.
            per_page: Page size, capped at 200 by the API.

        Returns:
            A catalogue whose :attr:`source` is the base URL.

        Raises:
            CatalogueError: If the API cannot be read or returns an error body.

        Example::

            cat = Catalogue.from_api()
        """
        import requests

        http = session or requests.Session()
        base = base_url.rstrip("/")

        def fetch(path: str, params: Optional[Dict[str, Any]] = None) -> Any:
            url = f"{base}{path}"
            try:
                response = http.get(url, params=params, timeout=timeout)
            except Exception as exc:  # pragma: no cover - network failure path
                raise CatalogueError(f"could not reach the ngano API at {url}: {exc}") from exc
            if response.status_code >= 400:
                raise CatalogueError(
                    f"the ngano API returned HTTP {response.status_code} for {url}"
                )
            try:
                return response.json()
            except ValueError as exc:
                raise CatalogueError(f"the ngano API returned a non-JSON body for {url}") from exc

        records: List[Mapping[str, Any]] = []
        page = 1
        while True:
            payload = fetch("/datasets", {"page": page, "per_page": per_page})
            if not isinstance(payload, Mapping) or "data" not in payload:
                raise CatalogueError("unexpected /datasets response: no data key")
            chunk = list(payload["data"])
            records.extend(chunk)
            meta = payload.get("meta") or {}
            total_pages = int(meta.get("total_pages", 1) or 1)
            if page >= total_pages or not chunk:
                break
            page += 1

        countries = fetch("/countries")
        languages = fetch("/languages")
        schema = fetch("/schema")
        return cls(
            records=records,
            countries=countries,
            languages=languages,
            field_map=schema,
            source=base,
        )

    # -------------------------------------------------------------- querying

    def __len__(self) -> int:
        """Return the number of records in the catalogue."""
        return len(self._records)

    def __iter__(self) -> Iterator[DatasetRecord]:
        """Iterate over every record in catalogue order."""
        return iter(self._records)

    @property
    def records(self) -> List[DatasetRecord]:
        """A copy of every record, in catalogue order."""
        return list(self._records)

    @property
    def field_map(self) -> FieldMap:
        """The column mapping rules that go with this catalogue."""
        return self._field_map

    def datasets(
        self,
        filter: Optional[Filter] = None,
        **kwargs: Any,
    ) -> List[DatasetRecord]:
        """Return the records matching a filter.

        Args:
            filter: A prepared :class:`~ngano.Filter`. Keyword arguments are
                merged on top of it.
            **kwargs: Filter keyword arguments, for example
                ``language="sna", commercial=True, task="ASR"``. A language may
                be a BCP 47 tag, a bare ISO 639-3 code or a catalogued name.

        Returns:
            The matching records, sorted when the filter sets ``sort``.

        Example:
            >>> cat = Catalogue()
            >>> shona = cat.datasets(language="Shona", task="ASR")
            >>> all("sna" in record.language_tags for record in shona)
            True
        """
        query = filter or Filter()
        if kwargs:
            query = query.merge(Filter(**kwargs))
        return query.apply(self._records)

    def get(self, dataset_id: str) -> DatasetRecord:
        """Look up one record by catalogue id or Hugging Face repo.

        Args:
            dataset_id: A catalogue id such as ``"waxal-corpus-paper"``, or a
                repo id such as ``"google/fleurs"``.

        Returns:
            The record.

        Raises:
            DatasetNotFoundError: If nothing matches.
        """
        record = self._by_id.get(dataset_id)
        if record is not None:
            return record
        record = self._by_repo.get(dataset_id.casefold())
        if record is not None:
            return record
        raise DatasetNotFoundError(dataset_id)

    def find(self, dataset_id: str) -> Optional[DatasetRecord]:
        """Look up one record, returning ``None`` instead of raising.

        Args:
            dataset_id: A catalogue id or Hugging Face repo.

        Returns:
            The record, or ``None``.
        """
        try:
            return self.get(dataset_id)
        except DatasetNotFoundError:
            return None

    def search(self, query: str, limit: Optional[int] = None) -> List[DatasetRecord]:
        """Free-text search across names, notes, languages and countries.

        Results are ranked: a name match first, then an id or repo match, then
        anything else, with larger published corpora first inside each band.

        Args:
            query: The text to look for, matched case-insensitively.
            limit: Optional maximum number of results.

        Returns:
            The matching records.

        Example:
            >>> hits = Catalogue().search("parliament")
            >>> len(hits) > 0
            True
        """
        needle = query.casefold().strip()
        if not needle:
            return []
        matches = Filter(q=needle).apply(self._records)

        def rank(record: DatasetRecord) -> Tuple[int, float]:
            if needle in record.name.casefold():
                band = 0
            elif needle in record.id.casefold() or needle in (record.hf_repo or "").casefold():
                band = 1
            else:
                band = 2
            return band, -(record.hours_num or 0.0)

        matches.sort(key=rank)
        return matches[:limit] if limit else matches

    # ---------------------------------------------------------------- facets

    def countries(self) -> List[CountryRecord]:
        """Return every country with its catalogue counts.

        Hours exclude records flagged ``unverified_size``.

        Returns:
            Country records sorted by name.

        Example:
            >>> zw = [c for c in Catalogue().countries() if c.iso2 == "ZW"][0]
            >>> zw.datasets > 0
            True
        """
        counts: "Counter[str]" = Counter()
        hours: Dict[str, float] = defaultdict(float)
        languages: Dict[str, Set[str]] = defaultdict(set)
        for record in self._records:
            for code in record.country_codes:
                key = str(code).upper()
                counts[key] += 1
                hours[key] += record.countable_hours
                languages[key].update(record.languages_clean or record.languages)

        out: List[CountryRecord] = []
        for raw in self._raw_countries:
            iso2 = str(raw.get("iso2", "")).upper()
            out.append(
                CountryRecord(
                    name=str(raw.get("name", iso2)),
                    iso2=iso2,
                    iso3=raw.get("iso3"),
                    map_name=raw.get("map_name"),
                    lat=raw.get("lat"),
                    lon=raw.get("lon"),
                    region=raw.get("region"),
                    slug=raw.get("slug"),
                    datasets=counts.get(iso2, 0),
                    hours=round(hours.get(iso2, 0.0), 2),
                    languages=len(languages.get(iso2, set())),
                )
            )
        out.sort(key=lambda c: c.name)
        return out

    def country(self, iso2: str) -> CountryRecord:
        """Look up one country by ISO 3166-1 alpha-2 code.

        Args:
            iso2: The two-letter code, case-insensitive.

        Returns:
            The country record.

        Raises:
            DatasetNotFoundError: If the code is unknown.
        """
        wanted = iso2.upper()
        for country in self.countries():
            if country.iso2 == wanted:
                return country
        raise DatasetNotFoundError(iso2)

    def language_codes(self) -> List[LanguageCode]:
        """Return the ISO 639-3 registry every language filter resolves through.

        Returns:
            One :class:`~ngano.LanguageCode` per known BCP 47 tag, in registry
            order.

        Example:
            >>> codes = Catalogue().language_codes()
            >>> next(code.name for code in codes if code.tag == "eng-NG")
            'English (Nigeria)'
        """
        return self._registry.codes

    def resolve_language(self, value: str) -> Optional[str]:
        """Resolve any language spelling to its canonical BCP 47 tag.

        A tag, a bare ISO 639-3 code and any catalogued name are all accepted.
        A tag always beats a name, and nothing is guessed: an unknown value
        gives ``None`` rather than a near match.

        Args:
            value: A tag such as ``"eng-ng"``, a code such as ``"sna"`` or a
                name such as ``"isiZulu"``.

        Returns:
            The canonical tag, or ``None`` when the value resolves to nothing.

        Example:
            >>> cat = Catalogue()
            >>> cat.resolve_language("isiZulu"), cat.resolve_language("ENG-ng")
            ('zul', 'eng-NG')
            >>> cat.resolve_language("Many African languages") is None
            True
        """
        return self._registry.resolve_one(value)

    def languages(self) -> List[LanguageRecord]:
        """Return every language with its catalogue counts, keyed on its tag.

        Counts are recomputed from the records in this catalogue, so they stay
        consistent when the catalogue came from the live API. Hours are
        apportioned evenly across each record's tags, and records flagged
        ``unverified_size`` are excluded, which is what the API does too.

        Returns:
            Language records sorted by dataset count, then name.

        Example:
            >>> sna = [lang for lang in Catalogue().languages() if lang.tag == "sna"][0]
            >>> sna.name, sna.datasets > 0
            ('Shona', True)
        """
        counts: "Counter[str]" = Counter()
        hours: Dict[str, float] = defaultdict(float)
        codes: Dict[str, Set[str]] = defaultdict(set)
        tasks: Dict[str, Set[str]] = defaultdict(set)
        for record in self._records:
            tags = [str(tag) for tag in record.language_tags]
            if not tags:
                continue
            share = record.countable_hours / len(tags)
            for tag in tags:
                counts[tag] += 1
                hours[tag] += share
                codes[tag].update(str(code).upper() for code in record.country_codes)
                if record.task:
                    tasks[tag].add(str(record.task))

        names = {country.iso2: country.name for country in self.countries()}

        out: List[LanguageRecord] = []
        for raw in self._raw_languages:
            tag = str(raw.get("tag") or raw.get("slug") or raw.get("name", ""))
            country_codes = sorted(
                (code for code in codes.get(tag, set()) if code in names),
                key=lambda code: (names[code], code),
            )
            aliases = raw.get("aliases") or []
            out.append(
                LanguageRecord(
                    tag=tag,
                    name=str(raw.get("name", tag)),
                    slug=str(raw.get("slug", tag.lower())),
                    iso639_3=str(raw.get("iso639_3", tag.split("-")[0])),
                    region=str(raw["region"]) if raw.get("region") else None,
                    scope=str(raw.get("scope", "")),
                    type=str(raw.get("type", "")),
                    aliases=[str(alias) for alias in aliases]
                    if isinstance(aliases, (list, tuple))
                    else [],
                    datasets=counts.get(tag, 0),
                    hours=round(hours.get(tag, 0.0), 1),
                    countries=[names[code] for code in country_codes],
                    country_codes=country_codes,
                    tasks=sorted(tasks.get(tag, set())),
                )
            )
        out.sort(key=lambda entry: (-entry.datasets, entry.name))
        return out

    def language(self, value: str) -> LanguageRecord:
        """Look up one language by tag, code, slug or any catalogued name.

        The value is resolved through the ISO 639-3 registry first, so
        ``"sna"``, ``"SNA"`` and ``"Shona"`` all reach the same record. A bare
        code is never widened to a regional variety here.

        Args:
            value: A tag such as ``"eng-NG"``, a code such as ``"sna"``, a slug
                such as ``"eng-ng"`` or a name such as ``"isiZulu"``.

        Returns:
            The language record.

        Raises:
            DatasetNotFoundError: If the language is unknown.

        Example:
            >>> Catalogue().language("Shona").tag
            'sna'
        """
        languages = self.languages()
        tag = self._registry.resolve_one(value)
        if tag is not None:
            for language in languages:
                if language.tag == tag:
                    return language
        wanted = value.casefold()
        for language in languages:
            if language.slug.casefold() == wanted or language.name.casefold() == wanted:
                return language
        raise DatasetNotFoundError(value)

    def stats(self) -> Dict[str, Any]:
        """Return global and per-facet aggregates.

        Every hours figure excludes records flagged ``unverified_size``, and the
        number of such records is reported separately so the exclusion is
        visible rather than silent. Languages are counted per BCP 47 tag, so a
        regional variety such as ``eng-NG`` counts separately from ``eng``, and
        per bare ISO 639-3 code as well, which collapses the varieties.

        Returns:
            A JSON-serialisable mapping of aggregates.

        Example:
            >>> stats = Catalogue().stats()
            >>> stats["datasets"] > 0 and stats["hours"] > 0
            True
        """
        total_hours = 0.0
        unverified_records = 0
        unverified_hours = 0.0
        loadable = 0
        with_hours = 0
        facets: Dict[str, "Counter[str]"] = {name: Counter() for name in _FACETS}
        region_counts: "Counter[str]" = Counter()
        language_counts: "Counter[str]" = Counter()
        code_counts: "Counter[str]" = Counter()
        country_counts: "Counter[str]" = Counter()

        for record in self._records:
            total_hours += record.countable_hours
            if record.unverified_size:
                unverified_records += 1
                unverified_hours += float(record.hours_num or 0.0)
            if record.hf_repo:
                loadable += 1
            if record.hours_num is not None:
                with_hours += 1
            for facet in _FACETS:
                value = getattr(record, facet, None)
                facets[facet][str(value) if value else "Unstated"] += 1
            for region in record.regions:
                region_counts[str(region)] += 1
            for tag in {str(t) for t in record.language_tags}:
                language_counts[tag] += 1
            for code in {str(c) for c in record.language_codes}:
                code_counts[code] += 1
            for code in record.country_codes:
                country_counts[str(code).upper()] += 1

        return {
            "datasets": len(self._records),
            "hours": round(total_hours, 2),
            "hours_note": (
                "totals exclude self-reported figures of 20,000 hours or more, "
                "which the catalogue flags as unverified_size"
            ),
            "languages": len(language_counts),
            "language_codes": len(code_counts),
            "countries": len(country_counts),
            "loadable": loadable,
            "with_hours": with_hours,
            "unverified": {
                "datasets": unverified_records,
                "excluded_hours": round(unverified_hours, 2),
            },
            "by_task": dict(facets["task"].most_common()),
            "by_variety": dict(facets["variety"].most_common()),
            "by_commercial": dict(facets["commercial"].most_common()),
            "by_access": dict(facets["access"].most_common()),
            "by_labelled": dict(facets["labelled"].most_common()),
            "by_quality": dict(facets["quality"].most_common()),
            "by_licence_class": dict(facets["licence_class"].most_common()),
            "by_host": dict(facets["host"].most_common()),
            "by_region": dict(region_counts.most_common()),
            "top_languages": [
                {
                    "tag": tag,
                    "name": self._registry.name(tag),
                    "datasets": count,
                }
                for tag, count in language_counts.most_common(20)
            ],
            "top_countries": [
                {"iso2": code, "datasets": count} for code, count in country_counts.most_common(20)
            ],
            "source": self.source,
        }


_DEFAULT: Optional[Catalogue] = None


def default_catalogue() -> Catalogue:
    """Return a process-wide catalogue built from the bundled snapshot.

    The snapshot is parsed once and shared, so repeated calls to
    :func:`ngano.load` do not re-read the JSON.

    Returns:
        The shared offline catalogue.
    """
    global _DEFAULT
    if _DEFAULT is None:
        _DEFAULT = Catalogue()
    return _DEFAULT
