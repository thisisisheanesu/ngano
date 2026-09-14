#!/usr/bin/env python3
"""Build a training manifest from a filtered slice of the ngano catalogue.

Writes one JSON Lines file where each line is a canonical ngano row, ready for
a data loader that expects a manifest rather than a streaming dataset.

    python build_manifest.py --language Hausa --out hausa.jsonl --limit 5000

Nothing is downloaded except metadata. The `audio` field stays a lazy handle, so
a manifest of a million rows costs no audio bandwidth. Decode later, from the
URL or path in each row.

Gated repos need a Hugging Face token:

    export HF_TOKEN="hf_..."

Records with `access: Request`, `Paid` or `Scrape required` are skipped with a
note, because a token will not make them loadable. Someone has to ask or pay
first.

Requires: pip install "ngano[hf]"
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict, is_dataclass
from pathlib import Path

from ngano import Catalogue, load

SKIPPABLE_ACCESS = {"Request", "Paid", "Scrape required", "Unclear"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--language", help="language name, for example Hausa")
    parser.add_argument("--country", help="ISO 3166-1 alpha-2 code, for example NG")
    parser.add_argument("--region", help="one of the seven ngano regions")
    parser.add_argument("--split", default="train", help="source split to read (default: train)")
    parser.add_argument("--min-hours", type=float, default=None,
                        help="only datasets stating at least this many hours")
    parser.add_argument("--limit", type=int, default=1000,
                        help="stop after this many rows (default: 1000)")
    parser.add_argument("--out", type=Path, default=Path("manifest.jsonl"),
                        help="output JSON Lines path")
    parser.add_argument("--commercial-only", action="store_true",
                        help="only datasets whose licence permits commercial use")
    return parser.parse_args()


def row_to_dict(row: object) -> dict:
    """Normalise a row into plain JSON-serialisable data."""
    if is_dataclass(row):
        data = asdict(row)
    elif hasattr(row, "to_dict"):
        data = row.to_dict()
    else:
        data = dict(row)  # type: ignore[arg-type]
    audio = data.get("audio")
    if isinstance(audio, dict):
        # Keep the handle, drop any eagerly loaded bytes so the manifest stays small.
        data["audio"] = {k: v for k, v in audio.items() if k != "bytes"}
    return data


def main() -> int:
    args = parse_args()

    catalogue = Catalogue.load()
    query: dict[str, object] = {"hf_only": True, "access": "Open"}
    if args.language:
        query["language"] = args.language
    if args.country:
        query["country"] = args.country
    if args.region:
        query["region"] = args.region
    if args.min_hours is not None:
        query["min_hours"] = args.min_hours
    if args.commercial_only:
        query["commercial"] = "Yes"

    datasets = catalogue.search(**query)
    if not datasets:
        print("no datasets matched that filter", file=sys.stderr)
        print("try a broader one, or browse https://ngano.dev", file=sys.stderr)
        return 1

    loadable = [d for d in datasets if d.access not in SKIPPABLE_ACCESS]
    for skipped in (d for d in datasets if d.access in SKIPPABLE_ACCESS):
        print(f"skipping {skipped.id}: access is {skipped.access}", file=sys.stderr)

    if not loadable:
        print("every match needs a request, a purchase or a scrape", file=sys.stderr)
        return 1

    stated = [d for d in loadable if d.hours_num and not d.unverified_size]
    total_hours = sum(d.hours_num for d in stated)
    print(f"{len(loadable)} datasets, {len(stated)} state a size, "
          f"{total_hours:,.0f} verified hours between them", file=sys.stderr)
    if not os.environ.get("HF_TOKEN"):
        print("HF_TOKEN is not set. Gated repos in this selection will fail.", file=sys.stderr)

    written = 0
    with args.out.open("w", encoding="utf-8") as handle:
        for row in load(loadable, split=args.split):
            handle.write(json.dumps(row_to_dict(row), ensure_ascii=False) + "\n")
            written += 1
            if written % 500 == 0:
                print(f"  {written} rows", file=sys.stderr)
            if written >= args.limit:
                break

    print(f"wrote {written} rows to {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
