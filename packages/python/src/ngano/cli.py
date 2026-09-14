"""The ``ngano`` command line interface.

Built on argparse alone, so installing ngano pulls in no CLI framework.

Examples::

    ngano search parliament --limit 5
    ngano search --language sna --task ASR --commercial
    ngano search --language eng --include-varieties
    ngano show google/fleurs --json
    ngano countries --region "Southern Africa"
    ngano languages --min-datasets 5
    ngano stats --json
    ngano load --language sna --task ASR --limit 20 --out rows.jsonl

Language values are BCP 47 tags such as ``sna`` or ``eng-NG``. A bare ISO 639-3
code and any catalogued name, for example ``isiZulu``, are accepted too and are
resolved to a tag before the catalogue is searched.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Callable, Dict, List, Optional, Sequence, TextIO

from . import __version__
from .catalogue import DEFAULT_API_BASE, Catalogue
from .errors import NganoError
from .filters import Filter
from .loader import INTERLEAVE_STRATEGIES, load
from .models import DatasetRecord

__all__ = ["main", "build_parser"]

_FILTER_OPTIONS = (
    (
        "--language",
        "language",
        "BCP 47 tag such as sna or eng-NG, a bare ISO 639-3 code, or a language "
        "name. Repeatable or comma separated",
    ),
    ("--iso", "iso", "ISO 639-3 code, the code-shaped spelling of --language"),
    ("--country", "country", "ISO 3166-1 alpha-2 code or country name"),
    ("--region", "region", "region name, for example 'East Africa'"),
    ("--task", "task", "ASR, TTS, ASR+TTS, Raw source or Other"),
    ("--variety", "variety", "variety label, for example Indigenous"),
    ("--licence-class", "licence_class", "licence class string"),
    ("--access", "access", "Open, Request, Paid, Scrape required or Unclear"),
    ("--labelled", "labelled", "Transcribed, Unlabelled or Unstated"),
    ("--quality", "quality", "quality band string"),
    ("--domain", "domain", "domain string"),
    ("--host", "host", "host string, for example HuggingFace"),
)


def _add_global_options(parser: argparse.ArgumentParser, suppress: bool = False) -> None:
    """Attach the options that every command accepts.

    Args:
        parser: The parser or subparser to extend.
        suppress: On a subparser, leave the value out of the namespace when the
            flag is absent, so a flag given before the command is not clobbered.
    """
    default: Any = argparse.SUPPRESS if suppress else False
    parser.add_argument(
        "--json", action="store_true", default=default,
        help="emit JSON instead of formatted text",
    )
    parser.add_argument(
        "--api", action="store_true", default=default,
        help="read the live catalogue from the ngano API instead of the bundled snapshot",
    )
    parser.add_argument(
        "--api-base",
        default=argparse.SUPPRESS if suppress else DEFAULT_API_BASE,
        help="override the API base URL",
    )


def _add_filter_options(parser: argparse.ArgumentParser) -> None:
    """Attach the shared catalogue filter options to a subparser."""
    for flag, dest, help_text in _FILTER_OPTIONS:
        parser.add_argument(flag, dest=dest, action="append", help=help_text)
    parser.add_argument("-q", "--query", dest="q", help="free-text search")
    parser.add_argument(
        "--commercial",
        action="store_true",
        help="only datasets whose commercial field is 'Yes'",
    )
    parser.add_argument(
        "--include-purchasable",
        action="store_true",
        help="widen --commercial to include 'Yes, if purchased'",
    )
    parser.add_argument(
        "--include-varieties",
        action="store_true",
        dest="include_varieties",
        help="widen a bare language code to its regional varieties, so eng also "
        "matches eng-NG and eng-ZA",
    )
    parser.add_argument(
        "--hf-only", action="store_true", help="only datasets with a Hugging Face repo"
    )
    parser.add_argument("--min-hours", type=float, help="minimum published hours")
    parser.add_argument("--max-hours", type=float, help="maximum published hours")
    parser.add_argument("--sort", help="hours, name or year, prefix with - for descending")


def _filter_from_args(args: argparse.Namespace) -> Filter:
    """Build a :class:`~ngano.Filter` from parsed command line arguments."""
    payload: Dict[str, Any] = {}
    for _, dest, _ in _FILTER_OPTIONS:
        value = getattr(args, dest, None)
        if value:
            payload[dest] = value
    for name in ("q", "min_hours", "max_hours", "sort"):
        value = getattr(args, name, None)
        if value is not None:
            payload[name] = value
    if getattr(args, "commercial", False):
        payload["commercial"] = True
    if getattr(args, "include_purchasable", False):
        payload["include_purchasable"] = True
    if getattr(args, "include_varieties", False):
        payload["include_varieties"] = True
    if getattr(args, "hf_only", False):
        payload["hf_only"] = True
    return Filter.from_mapping(payload)


def _catalogue(args: argparse.Namespace) -> Catalogue:
    """Return the catalogue the command should read, bundled or live."""
    if getattr(args, "api", False):
        return Catalogue.from_api(getattr(args, "api_base", DEFAULT_API_BASE))
    return Catalogue()


def _emit(payload: Any, stream: TextIO) -> None:
    """Write a JSON payload followed by a newline."""
    json.dump(payload, stream, ensure_ascii=False, indent=2, default=str)
    stream.write("\n")


def _format_record(record: DatasetRecord) -> str:
    """Render one record as a single readable line."""
    hours = f"{record.hours_num:,.0f}h" if record.hours_num is not None else "hours unstated"
    if record.unverified_size:
        hours += " (unverified)"
    if record.language_tags:
        languages = ", ".join(record.language_tags)
    elif record.language_note:
        languages = "languages described in prose, see language_note"
    else:
        languages = "language unstated"
    repo = record.hf_repo or "no hf repo"
    return f"{record.id}\n    {record.name}\n    {languages} | {record.task or 'task unstated'} | {hours} | {repo}"


def _cmd_search(args: argparse.Namespace, out: TextIO) -> int:
    """Run the ``search`` command."""
    cat = _catalogue(args)
    query = _filter_from_args(args)
    if args.terms:
        term = " ".join(args.terms)
        records = cat.search(term, limit=None)
        records = [record for record in records if query.matches(record)]
    else:
        records = cat.datasets(query)
    if args.limit:
        records = records[: args.limit]
    if args.json:
        _emit([record.to_dict() for record in records], out)
        return 0
    if not records:
        out.write("no datasets matched\n")
        return 0
    for record in records:
        out.write(_format_record(record) + "\n")
    out.write(f"\n{len(records)} datasets\n")
    return 0


def _cmd_show(args: argparse.Namespace, out: TextIO) -> int:
    """Run the ``show`` command."""
    cat = _catalogue(args)
    record = cat.get(args.dataset_id)
    if args.json:
        _emit(record.to_dict(), out)
        return 0
    payload = record.to_dict()
    width = max(len(key) for key in payload)
    for key, value in payload.items():
        if isinstance(value, list):
            value = ", ".join(str(item) for item in value)
        out.write(f"{key.ljust(width)}  {value if value is not None else '-'}\n")
    return 0


def _cmd_countries(args: argparse.Namespace, out: TextIO) -> int:
    """Run the ``countries`` command."""
    cat = _catalogue(args)
    countries = cat.countries()
    if args.region:
        wanted = args.region.casefold()
        countries = [c for c in countries if (c.region or "").casefold() == wanted]
    if args.json:
        _emit([country.to_dict() for country in countries], out)
        return 0
    for country in countries:
        out.write(
            f"{country.iso2}  {country.name.ljust(26)} {country.datasets:>4} datasets  "
            f"{country.hours:>12,.0f} h  {country.languages:>4} languages\n"
        )
    out.write(f"\n{len(countries)} countries\n")
    return 0


def _cmd_languages(args: argparse.Namespace, out: TextIO) -> int:
    """Run the ``languages`` command."""
    cat = _catalogue(args)
    languages = cat.languages()
    if args.min_datasets:
        languages = [lang for lang in languages if lang.datasets >= args.min_datasets]
    if args.limit:
        languages = languages[: args.limit]
    if args.json:
        _emit([language.to_dict() for language in languages], out)
        return 0
    for language in languages:
        out.write(
            f"{language.tag.ljust(8)} {language.iso639_3.ljust(5)} "
            f"{language.name.ljust(30)} {language.datasets:>4} datasets  "
            f"{language.hours:>12,.0f} h\n"
        )
    out.write(f"\n{len(languages)} languages\n")
    return 0


def _cmd_stats(args: argparse.Namespace, out: TextIO) -> int:
    """Run the ``stats`` command."""
    cat = _catalogue(args)
    stats = cat.stats()
    if args.json:
        _emit(stats, out)
        return 0
    out.write(f"datasets     {stats['datasets']:,}\n")
    out.write(f"hours        {stats['hours']:,.0f}\n")
    out.write(f"languages    {stats['languages']:,}\n")
    out.write(f"countries    {stats['countries']:,}\n")
    out.write(f"loadable     {stats['loadable']:,} with a Hugging Face repo\n")
    unverified = stats["unverified"]
    out.write(
        f"excluded     {unverified['datasets']:,} datasets flagged unverified_size, "
        f"{unverified['excluded_hours']:,.0f} hours not counted\n"
    )
    for facet in ("by_task", "by_access", "by_commercial", "by_licence_class"):
        out.write(f"\n{facet[3:]}\n")
        for key, value in stats[facet].items():
            out.write(f"  {str(key).ljust(28)} {value:>5,}\n")
    return 0


def _cmd_load(args: argparse.Namespace, out: TextIO) -> int:
    """Run the ``load`` command."""
    cat = _catalogue(args)
    stream = load(
        filter=_filter_from_args(args),
        catalogue=cat,
        split=args.split,
        limit=args.limit,
        interleave=args.interleave,
        hf_token=args.hf_token,
        on_error="warn",
    )
    if not args.json:
        out.write(
            f"{stream.matched} datasets matched, {stream.loadable} can be streamed "
            f"from Hugging Face\n"
        )
    if args.dry_run:
        if args.json:
            _emit(
                {
                    "matched": stream.matched,
                    "loadable": stream.loadable,
                    "datasets": [record.hf_repo for record in stream.records],
                },
                out,
            )
        else:
            for record in stream.records:
                out.write(f"  {record.hf_repo}  ({record.id})\n")
        return 0

    if args.out:
        written = stream.to_jsonl(args.out)
        if args.json:
            _emit({"written": written, "path": args.out}, out)
        else:
            out.write(f"wrote {written} rows to {args.out}\n")
        return 0

    count = 0
    for row in stream:
        out.write(json.dumps(row.to_dict(), ensure_ascii=False, default=str) + "\n")
        count += 1
    if not args.json:
        out.write(f"{count} rows\n")
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser for the ``ngano`` command.

    Returns:
        The configured parser, with one subparser per command.
    """
    parser = argparse.ArgumentParser(
        prog="ngano",
        description="Catalogue and streaming loader for African-language speech datasets.",
    )
    parser.add_argument("--version", action="version", version=f"ngano {__version__}")
    _add_global_options(parser)

    sub = parser.add_subparsers(dest="command")

    search = sub.add_parser("search", help="search the catalogue")
    search.add_argument("terms", nargs="*", help="free-text search terms")
    search.add_argument("--limit", type=int, help="maximum results")
    _add_filter_options(search)
    _add_global_options(search, suppress=True)
    search.set_defaults(func=_cmd_search)

    show = sub.add_parser("show", help="show one dataset by id or Hugging Face repo")
    show.add_argument("dataset_id")
    _add_global_options(show, suppress=True)
    show.set_defaults(func=_cmd_show)

    countries = sub.add_parser("countries", help="list countries with their counts")
    countries.add_argument("--region", help="restrict to one region")
    _add_global_options(countries, suppress=True)
    countries.set_defaults(func=_cmd_countries)

    languages = sub.add_parser("languages", help="list languages with their counts")
    languages.add_argument("--min-datasets", type=int, dest="min_datasets")
    languages.add_argument("--limit", type=int, help="maximum results")
    _add_global_options(languages, suppress=True)
    languages.set_defaults(func=_cmd_languages)

    stats = sub.add_parser("stats", help="show catalogue aggregates")
    _add_global_options(stats, suppress=True)
    stats.set_defaults(func=_cmd_stats)

    load_cmd = sub.add_parser("load", help="stream canonical rows from matching datasets")
    load_cmd.add_argument("--limit", type=int, default=10, help="maximum rows (default 10)")
    load_cmd.add_argument("--out", help="write JSON Lines to this path instead of stdout")
    load_cmd.add_argument("--split", default="train", help="split name (default train)")
    load_cmd.add_argument(
        "--interleave",
        default="round_robin",
        choices=list(INTERLEAVE_STRATEGIES),
        help="how to interleave multiple datasets",
    )
    load_cmd.add_argument("--hf-token", dest="hf_token", help="Hugging Face token")
    load_cmd.add_argument(
        "--dry-run",
        action="store_true",
        help="list the datasets that would be streamed and stop",
    )
    _add_filter_options(load_cmd)
    _add_global_options(load_cmd, suppress=True)
    load_cmd.set_defaults(func=_cmd_load)

    return parser


def main(argv: Optional[Sequence[str]] = None, out: Optional[TextIO] = None) -> int:
    """Run the ``ngano`` command line interface.

    Args:
        argv: Argument list, defaulting to ``sys.argv[1:]``.
        out: Stream to write to, defaulting to standard output.

    Returns:
        A process exit code. ``0`` on success, ``1`` on a handled ngano error,
        ``2`` when no command was given.

    Example::

        raise SystemExit(main(["stats", "--json"]))
    """
    parser = build_parser()
    args = parser.parse_args(argv)
    stream = out or sys.stdout
    if not getattr(args, "func", None):
        parser.print_help(stream)
        return 2
    handler: Callable[[argparse.Namespace, TextIO], int] = args.func
    try:
        return handler(args, stream)
    except NganoError as exc:
        if args.json:
            _emit({"error": {"message": str(exc), "type": type(exc).__name__}}, stream)
        else:
            sys.stderr.write(f"ngano: {exc}\n")
        return 1


if __name__ == "__main__":  # pragma: no cover - module entry point
    raise SystemExit(main())
