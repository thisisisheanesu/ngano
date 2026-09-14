"""Streaming loaders that unify many Hugging Face datasets into one row stream.

Nothing is materialised. Each source dataset is opened as a streaming Hugging
Face dataset, its real columns are inspected once, and rows are mapped to the
canonical :class:`~ngano.Row` as they arrive. A caller can break out of the loop
after a handful of rows and the rest is never fetched.

Which datasets are streamed is decided by a :class:`~ngano.Filter`, so language
selection happens on BCP 47 tags. A ``language`` value may be a tag, a bare ISO
639-3 code or a catalogued name, and it is resolved to tags before anything is
opened.

Example::

    from ngano import load
    stream = load(language=["sna", "nde"], commercial=True, task="ASR", limit=50)
    print(stream.matched, stream.loadable)
    for row in stream:
        print(row.language, row.transcript)
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from functools import partial
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    Iterator,
    List,
    Mapping,
    Optional,
    Sequence,
    Tuple,
)

from .auth import resolve_token
from .catalogue import Catalogue, default_catalogue
from .errors import GatedDatasetError, LoaderError
from .filters import Filter
from .languages import default_registry
from .mapping import ColumnPlan, FieldMap, build_row
from .models import DatasetRecord, Row

__all__ = ["Stream", "load", "load_dataset", "open_streaming_dataset", "INTERLEAVE_STRATEGIES"]

#: The interleaving strategies accepted by :func:`load`.
INTERLEAVE_STRATEGIES = ("round_robin", "sequential", "weighted_by_hours")

#: Column name used to carry provenance through a native interleave.
_SOURCE_KEY = "_ngano_source_index"

_GATED_MARKERS = (
    "401",
    "403",
    "gated",
    "is not a public",
    "restricted",
    "unauthorized",
    "authentication",
    "you must be authenticated",
    "access to this dataset",
)


def _tag_source(index: int, example: Mapping[str, Any]) -> Dict[str, Any]:
    """Add a provenance column so an interleaved row still knows its dataset.

    Args:
        index: Position of the dataset in the stream's source list.
        example: The source row, which is left unchanged.

    Returns:
        The single extra column that ``IterableDataset.map`` merges in.
    """
    return {_SOURCE_KEY: index}


def open_streaming_dataset(
    repo: str,
    config: Optional[str] = None,
    split: str = "train",
    token: Optional[str] = None,
    streaming: bool = True,
) -> Tuple[Iterable[Mapping[str, Any]], Optional[List[str]]]:
    """Open one Hugging Face dataset and report its columns.

    This is the single point where ngano touches the ``datasets`` library, so
    tests replace it with fixtures and the rest of the package stays pure.

    Args:
        repo: Hugging Face repo id, for example ``"google/fleurs"``.
        config: Dataset configuration name, for example ``"sw_ke"``.
        split: Split name, for example ``"train"``.
        token: Hugging Face token, or ``None`` for anonymous access.
        streaming: Pass ``False`` to let ``datasets`` download the split first.
            ngano still yields rows lazily either way.

    Returns:
        A tuple of the iterable dataset and its column names, or ``None`` for
        the columns when the dataset does not declare features.

    Raises:
        GatedDatasetError: If the repo is gated, private or needs a token.
        LoaderError: If the dataset cannot be opened for any other reason.
    """
    try:
        import datasets as hf_datasets
    except ImportError as exc:  # pragma: no cover - core dependency
        raise LoaderError(
            "streaming needs the 'datasets' library. Install it with: pip install ngano"
        ) from exc

    kwargs: Dict[str, Any] = {"split": split, "streaming": streaming}
    if config:
        kwargs["name"] = config
    try:
        try:
            dataset = hf_datasets.load_dataset(repo, token=token, **kwargs)
        except TypeError:
            # datasets < 2.14 spells the argument use_auth_token.
            dataset = hf_datasets.load_dataset(repo, use_auth_token=token, **kwargs)
    except Exception as exc:
        message = str(exc)
        if any(marker in message.casefold() for marker in _GATED_MARKERS):
            raise GatedDatasetError(repo, message) from exc
        raise LoaderError(
            f"could not open the Hugging Face dataset {repo!r}"
            + (f" (config {config!r})" if config else "")
            + f" split {split!r}: {message}"
        ) from exc

    columns: Optional[List[str]] = None
    features = getattr(dataset, "features", None)
    if features:
        try:
            columns = [str(name) for name in features]
        except TypeError:  # pragma: no cover - unusual features object
            columns = None
    if columns is None:
        names = getattr(dataset, "column_names", None)
        if isinstance(names, (list, tuple)):
            columns = [str(name) for name in names]
    return dataset, columns


@dataclass
class _Source:
    """One dataset to be streamed, with the catalogue context for its rows."""

    record: Optional[DatasetRecord]
    repo: str
    config: Optional[str]
    weight: float


class Stream:
    """A lazy stream of canonical rows over one or more datasets.

    A stream is iterable once per call to :meth:`__iter__`; each iteration opens
    the underlying datasets afresh. Nothing is opened until iteration starts,
    so building a stream is cheap and free of network access.

    Attributes:
        matched: How many catalogue records matched the filter.
        loadable: How many of those have a Hugging Face repo and can be streamed.
        records: The matched records, in the order they will be streamed.
        split: The split requested from every dataset.
        limit: Maximum number of rows to yield, or ``None`` for no limit.
        interleave: The interleaving strategy in use.
    """

    def __init__(
        self,
        records: Sequence[DatasetRecord],
        *,
        matched: Optional[int] = None,
        split: str = "train",
        limit: Optional[int] = None,
        interleave: str = "round_robin",
        token: Optional[str] = None,
        config: Optional[str] = None,
        field_map: Optional[FieldMap] = None,
        streaming: bool = True,
        on_error: str = "warn",
        opener: Optional[Callable[..., Tuple[Iterable[Mapping[str, Any]], Optional[List[str]]]]] = None,
    ) -> None:
        """Build a stream. Prefer :func:`load` or :func:`load_dataset`.

        Args:
            records: Catalogue records to stream, loadable ones first.
            matched: How many records matched before the loadable filter.
            split: Split name requested from every dataset.
            limit: Maximum rows to yield.
            interleave: ``round_robin``, ``sequential`` or ``weighted_by_hours``.
            token: Hugging Face token, already resolved.
            config: Dataset configuration name, for a single repo load.
            field_map: Column mapping rules. Defaults to the bundled ones.
            streaming: Passed through to ``datasets.load_dataset``.
            on_error: ``warn`` to skip a dataset that fails to open, ``raise``
                to propagate, ``ignore`` to skip silently.
            opener: Function used to open a dataset. Defaults to
                :func:`open_streaming_dataset`.

        Raises:
            ValueError: If ``interleave`` or ``on_error`` is not recognised.
        """
        if interleave not in INTERLEAVE_STRATEGIES:
            raise ValueError(
                f"interleave must be one of {', '.join(INTERLEAVE_STRATEGIES)}, got {interleave!r}"
            )
        if on_error not in ("warn", "raise", "ignore"):
            raise ValueError("on_error must be 'warn', 'raise' or 'ignore'")

        self.records: List[DatasetRecord] = list(records)
        self.loadable: int = sum(1 for record in self.records if record.loadable)
        self.matched: int = matched if matched is not None else len(self.records)
        self.split = split
        self.limit = limit
        self.interleave = interleave
        self.streaming = streaming
        self.on_error = on_error
        self._token = token
        self._config = config
        self._field_map = field_map or FieldMap.default()
        self._opener = opener or open_streaming_dataset
        self._plans: Dict[str, ColumnPlan] = {}

    def __repr__(self) -> str:
        """Return a short summary of the stream's scope."""
        return (
            f"Stream(matched={self.matched}, loadable={self.loadable}, "
            f"split={self.split!r}, interleave={self.interleave!r}, limit={self.limit})"
        )

    @property
    def plans(self) -> Dict[str, ColumnPlan]:
        """Column plans discovered so far, keyed by repo.

        Populated as datasets are opened, so it is empty until iteration starts.
        """
        return dict(self._plans)

    # ----------------------------------------------------------- iteration

    def __iter__(self) -> Iterator[Row]:
        """Yield canonical rows, opening datasets only as they are needed."""
        sources = [
            _Source(
                record=record,
                repo=str(record.hf_repo),
                config=self._config,
                weight=max(record.countable_hours, 0.0) or 1.0,
            )
            for record in self.records
            if record.loadable
        ]
        if not sources:
            return

        produced = 0
        for row in self._merge(sources):
            yield row
            produced += 1
            if self.limit is not None and produced >= self.limit:
                return

    def take(self, count: int) -> List[Row]:
        """Return at most ``count`` rows, leaving the rest unfetched.

        Args:
            count: How many rows to pull.

        Returns:
            A list of up to ``count`` rows.
        """
        out: List[Row] = []
        for row in self:
            out.append(row)
            if len(out) >= count:
                break
        return out

    def to_jsonl(self, path: str, limit: Optional[int] = None) -> int:
        """Write rows to a JSON Lines file without audio bytes.

        Args:
            path: Destination file path.
            limit: Maximum rows to write, overriding the stream limit.

        Returns:
            The number of rows written.
        """
        import json

        written = 0
        with open(path, "w", encoding="utf-8") as handle:
            for row in self:
                handle.write(json.dumps(row.to_dict(), ensure_ascii=False) + "\n")
                written += 1
                if limit is not None and written >= limit:
                    break
        return written

    # ------------------------------------------------------------ internals

    def _open(self, source: _Source) -> Optional[Tuple[Iterable[Mapping[str, Any]], Optional[List[str]]]]:
        """Open one source, honouring the ``on_error`` policy."""
        try:
            return self._opener(
                source.repo,
                config=source.config,
                split=self.split,
                token=self._token,
                streaming=self.streaming,
            )
        except Exception as exc:
            if self.on_error == "raise":
                raise
            if self.on_error == "warn":
                warnings.warn(
                    f"ngano: skipping {source.repo}: {exc}", RuntimeWarning, stacklevel=3
                )
            return None

    def _rows(self, source: _Source) -> Iterator[Row]:
        """Open one source and yield its canonical rows, lazily."""
        opened = self._open(source)
        if opened is None:
            return
        for row in self._rows_from(source, opened[0], opened[1]):
            yield row

    def _plan_for(self, source: _Source, columns: Optional[Sequence[str]]) -> Optional[ColumnPlan]:
        """Compute and cache the column plan for a source, if columns are known."""
        if columns is None:
            return None
        plan = self._field_map.plan(list(columns), source.repo)
        self._plans[source.repo] = plan
        return plan

    def _build(self, source: _Source, plan: ColumnPlan, mapping: Mapping[str, Any]) -> Row:
        """Map one raw source row onto the canonical row, with catalogue context."""
        record = source.record
        catalogued = bool(record and not record.extra.get("_ngano_uncatalogued"))
        # A record that names several languages cannot attribute a row to one of
        # them, so only a single-language record contributes a tag or a code.
        tags = record.language_tags if record else []
        codes = record.language_codes if record else []
        tag = tags[0] if len(tags) == 1 else None
        code = codes[0] if len(codes) == 1 else None
        if code is None and tag is not None:
            code = tag.split("-")[0]
        name: Optional[str] = None
        if tag is not None:
            name = default_registry().name(tag)
        elif record and len(record.languages_clean) == 1:
            name = record.languages_clean[0]
        elif record and not tags and len(record.languages) == 1:
            name = record.languages[0]
        return build_row(
            mapping,
            plan,
            split=self.split,
            dataset_id=record.id if record and catalogued else None,
            hf_repo=source.repo,
            licence=record.licence if record else None,
            source_url=(record.url if record else None)
            or f"https://huggingface.co/datasets/{source.repo}",
            country=(record.country_codes[0] if record and record.country_codes else None),
            language=name,
            language_iso=code,
            language_tag=tag,
            domain=record.domain if record else None,
            token=self._token,
        )

    def _rows_from(
        self,
        source: _Source,
        dataset: Iterable[Mapping[str, Any]],
        columns: Optional[List[str]],
    ) -> Iterator[Row]:
        """Yield canonical rows from an already opened dataset, lazily."""
        plan = self._plan_for(source, columns)
        for raw in dataset:
            mapping: Mapping[str, Any] = raw if isinstance(raw, Mapping) else dict(raw)
            if plan is None:
                plan = self._field_map.plan(list(mapping.keys()), source.repo)
                self._plans[source.repo] = plan
            yield self._build(source, plan, mapping)

    def _merge(self, sources: Sequence[_Source]) -> Iterator[Row]:
        """Merge the per-source row iterators according to the strategy."""
        if len(sources) == 1 or self.interleave == "sequential":
            for source in sources:
                for row in self._rows(source):
                    yield row
            return

        opened: List[Tuple[_Source, Iterable[Mapping[str, Any]], Optional[List[str]]]] = []
        for source in sources:
            result = self._open(source)
            if result is not None:
                opened.append((source, result[0], result[1]))
        if not opened:
            return

        native = self._hf_interleave(opened)
        if native is not None:
            yield from native
            return

        generators: List[Optional[Iterator[Row]]] = [
            self._rows_from(source, dataset, columns) for source, dataset, columns in opened
        ]
        weights = [source.weight for source, _, _ in opened]
        if self.interleave == "weighted_by_hours":
            yield from _weighted_round_robin(generators, weights)
        else:
            yield from _round_robin(generators)

    def _hf_interleave(
        self,
        opened: Sequence[Tuple[_Source, Iterable[Mapping[str, Any]], Optional[List[str]]]],
    ) -> Optional[Iterator[Row]]:
        """Interleave with ``datasets.interleave_datasets`` when that is possible.

        The library needs every dataset to share one schema, so this path is
        taken only when the opened datasets are real streaming datasets with the
        same columns and the same column plan. Otherwise ``None`` is returned and
        the caller falls back to ngano's own round robin, which has no such
        requirement. Either way the merge stays lazy and a caller can break early.
        """
        try:
            import datasets as hf_datasets

            interleave_datasets = getattr(hf_datasets, "interleave_datasets", None)
            iterable_type = getattr(hf_datasets, "IterableDataset", None)
            if interleave_datasets is None or iterable_type is None:
                return None
            if not all(isinstance(dataset, iterable_type) for _, dataset, _ in opened):
                return None
            column_sets = [frozenset(columns) for _, _, columns in opened if columns]
            if len(column_sets) != len(opened) or len(set(column_sets)) != 1:
                return None

            plans: List[ColumnPlan] = []
            for source, _, columns in opened:
                plan = self._plan_for(source, columns)
                if plan is None:
                    return None
                plans.append(plan)
            first = plans[0]
            if any(
                plan.mapping != first.mapping or plan.conversions != first.conversions
                for plan in plans
            ):
                return None

            tagged = [
                dataset.map(partial(_tag_source, index))  # type: ignore[attr-defined]
                for index, (_, dataset, _) in enumerate(opened)
            ]
            kwargs: Dict[str, Any] = {"stopping_strategy": "all_exhausted"}
            if self.interleave == "weighted_by_hours":
                total = sum(source.weight for source, _, _ in opened) or 1.0
                kwargs["probabilities"] = [source.weight / total for source, _, _ in opened]
                kwargs["seed"] = 0
            try:
                merged = interleave_datasets(tagged, **kwargs)
            except TypeError:  # pragma: no cover - older datasets releases
                merged = interleave_datasets(tagged)
        except Exception:  # pragma: no cover - any incompatibility falls back
            return None

        def generate() -> Iterator[Row]:
            for raw in merged:
                mapping = dict(raw)
                index = int(mapping.pop(_SOURCE_KEY, 0))
                source = opened[index][0]
                yield self._build(source, plans[index], mapping)

        return generate()


def _round_robin(generators: Sequence[Optional[Iterator[Row]]]) -> Iterator[Row]:
    """Pull one row from each live generator in turn until all are exhausted.

    Only one row is ever held in memory, so breaking out of the loop leaves the
    remaining generators untouched.
    """
    live: List[Iterator[Row]] = [gen for gen in generators if gen is not None]
    while live:
        still_live: List[Iterator[Row]] = []
        for generator in live:
            try:
                yield next(generator)
            except StopIteration:
                continue
            still_live.append(generator)
        live = still_live


def _weighted_round_robin(
    generators: Sequence[Optional[Iterator[Row]]], weights: Sequence[float]
) -> Iterator[Row]:
    """Interleave generators in proportion to their weights, deterministically.

    Uses smooth weighted round robin, so a dataset with twice the hours yields
    roughly twice as many rows, with no randomness and no lookahead.
    """
    live: List[Tuple[Iterator[Row], float]] = [
        (gen, max(float(weight), 1e-9))
        for gen, weight in zip(generators, weights)
        if gen is not None
    ]
    if not live:
        return
    current = [0.0] * len(live)
    total = sum(weight for _, weight in live)
    active = list(range(len(live)))
    while active:
        for index in active:
            current[index] += live[index][1]
        best = max(active, key=lambda i: current[i])
        current[best] -= total
        try:
            yield next(live[best][0])
        except StopIteration:
            active.remove(best)
            total = sum(live[i][1] for i in active)
            if not active:
                return


def _warn_on_gap(matched: int, loadable: int) -> None:
    """Warn once when far fewer records are streamable than matched."""
    if matched <= 0 or loadable >= matched:
        return
    gap = matched - loadable
    if gap >= 5 and loadable < matched * 0.6:
        warnings.warn(
            f"ngano: {matched} datasets matched the filter but only {loadable} have a "
            "Hugging Face repo and can be streamed. The other "
            f"{gap} are catalogued sources you have to obtain from their host. "
            "Add hf_only=True to filter them out.",
            RuntimeWarning,
            stacklevel=3,
        )


def load(
    *,
    filter: Optional[Filter] = None,
    catalogue: Optional[Catalogue] = None,
    split: str = "train",
    streaming: bool = True,
    hf_token: Optional[str] = None,
    limit: Optional[int] = None,
    interleave: str = "round_robin",
    config: Optional[str] = None,
    on_error: str = "warn",
    **filter_kwargs: Any,
) -> Stream:
    """Stream canonical rows from every catalogue dataset matching a filter.

    Args:
        filter: A prepared :class:`~ngano.Filter`. Keyword arguments below are
            merged on top of it.
        catalogue: The catalogue to query. Defaults to the bundled snapshot, so
            this call needs no network beyond the datasets themselves.
        split: Split requested from each dataset.
        streaming: Passed to ``datasets.load_dataset``. Leave it true unless you
            deliberately want the split downloaded first.
        hf_token: Hugging Face token. Falls back to ``HF_TOKEN``, then
            ``HUGGING_FACE_HUB_TOKEN``, then anonymous access.
        limit: Stop after this many rows in total.
        interleave: ``round_robin`` (default), ``sequential`` or
            ``weighted_by_hours``.
        config: Dataset configuration name, applied to every dataset. Usually
            only meaningful for a single repo, see :func:`load_dataset`.
        on_error: ``warn`` to skip a dataset that will not open, ``raise`` to
            propagate the error, ``ignore`` to skip silently.
        **filter_kwargs: Filter keywords such as ``language``, ``country``,
            ``commercial``, ``task``, ``licence_class``, ``include_purchasable``
            and ``include_varieties``. ``language`` and ``iso`` accept tags,
            bare ISO 639-3 codes and catalogued names alike.

    Returns:
        A lazy :class:`Stream`. Read ``stream.matched`` and ``stream.loadable``
        to see how many records matched and how many can actually be streamed.

    Raises:
        ValueError: If ``interleave`` or ``on_error`` is not recognised.

    Example::

        stream = load(language=["sna", "nde"], country="ZW",
                      commercial=True, task="ASR", limit=10)
        for row in stream:
            print(row.transcript, row.audio.url)
    """
    cat = catalogue or default_catalogue()
    query = filter or Filter()
    if filter_kwargs:
        query = query.merge(Filter(**filter_kwargs))
    matched_records = query.apply(cat.records)
    loadable_records = [record for record in matched_records if record.loadable]
    _warn_on_gap(len(matched_records), len(loadable_records))
    return Stream(
        loadable_records,
        matched=len(matched_records),
        split=split,
        limit=limit,
        interleave=interleave,
        token=resolve_token(hf_token),
        config=config,
        field_map=cat.field_map,
        streaming=streaming,
        on_error=on_error,
    )


def load_dataset(
    repo: str,
    config: Optional[str] = None,
    *,
    split: str = "train",
    streaming: bool = True,
    hf_token: Optional[str] = None,
    limit: Optional[int] = None,
    catalogue: Optional[Catalogue] = None,
    on_error: str = "raise",
) -> Stream:
    """Stream one Hugging Face repo as canonical ngano rows.

    Catalogue metadata such as the licence, the ngano id and the language tag is
    attached when the repo is in the catalogue. A repo that is not catalogued
    still streams, with those fields left as ``None``.

    Args:
        repo: Hugging Face repo id, for example ``"google/fleurs"``.
        config: Dataset configuration name, for example ``"sw_ke"``.
        split: Split name.
        streaming: Passed to ``datasets.load_dataset``.
        hf_token: Hugging Face token, else ``HF_TOKEN``, else
            ``HUGGING_FACE_HUB_TOKEN``, else anonymous access.
        limit: Stop after this many rows.
        catalogue: The catalogue used to look the repo up.
        on_error: Defaults to ``raise`` here, since a single repo that will not
            open is usually a mistake worth surfacing.

    Returns:
        A lazy :class:`Stream` over the one repo.

    Example::

        for row in load_dataset("google/fleurs", config="sw_ke", limit=3):
            print(row.language_tag, row.language_iso, row.transcript)
    """
    cat = catalogue or default_catalogue()
    record = cat.find(repo)
    if record is None:
        record = DatasetRecord(
            id=repo,
            name=repo,
            hf_repo=repo,
            url=f"https://huggingface.co/datasets/{repo}",
        )
        record.extra["_ngano_uncatalogued"] = True
    return Stream(
        [record],
        matched=1,
        split=split,
        limit=limit,
        interleave="sequential",
        token=resolve_token(hf_token),
        config=config,
        field_map=cat.field_map,
        streaming=streaming,
        on_error=on_error,
    )
