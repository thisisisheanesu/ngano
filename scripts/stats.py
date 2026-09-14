#!/usr/bin/env python3
"""Print the headline numbers used in README.md and the docs.

Every figure here is derived from data/catalogue.json, data/countries.json and
data/languages.json at run time. Nothing is hardcoded, so regenerating after a
catalogue change is a single command:

    python scripts/stats.py            # human readable
    python scripts/stats.py --json     # machine readable

Records flagged `unverified_size` are counted as datasets but excluded from
every hours total, in line with the project rule that self-reported figures at
or above 20,000 hours are not treated as fact.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PAN_AFRICAN = "Pan-African"

REGION_ORDER = [
    "West Africa", "East Africa", "Southern Africa", "North Africa",
    "Horn of Africa", "Central Africa", "Island states",
]


def load(name: str) -> Any:
    with (DATA / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def compute() -> dict[str, Any]:
    catalogue = load("catalogue.json")
    countries = load("countries.json")
    languages = load("languages.json")

    verified = [r for r in catalogue if not r["unverified_size"]]
    unverified = [r for r in catalogue if r["unverified_size"]]

    covered_countries = set()
    for record in catalogue:
        covered_countries.update(c for c in record["countries"] if c != PAN_AFRICAN)

    catalogue_languages = set()
    for record in catalogue:
        catalogue_languages.update(record["languages_clean"])

    def facet(field: str) -> dict[str, int]:
        return dict(Counter(r[field] for r in catalogue).most_common())

    region_rows: list[dict[str, Any]] = []
    per_region: dict[str, list[float]] = defaultdict(lambda: [0, 0.0])
    region_languages: dict[str, set[str]] = defaultdict(set)
    for record in verified:
        for region in record["regions"]:
            per_region[region][0] += 1
            per_region[region][1] += record["hours_num"] or 0
    for record in catalogue:
        for region in record["regions"]:
            region_languages[region].update(record["languages_clean"])
    for region in REGION_ORDER:
        count, hours = per_region.get(region, (0, 0.0))
        region_rows.append({
            "region": region,
            "datasets": int(count),
            "hours": round(hours, 1),
            "languages": len(region_languages.get(region, set())),
        })

    top_languages = sorted(
        (lang for lang in languages if lang["datasets"]),
        key=lambda lang: (-lang["datasets"], lang["name"]),
    )[:10]

    return {
        "datasets": len(catalogue),
        "datasets_unverified": len(unverified),
        "datasets_with_hours": sum(1 for r in verified if r["hours_num"]),
        "hours_verified": round(sum(r["hours_num"] or 0 for r in verified), 1),
        "languages": len(languages),
        "languages_in_catalogue": len(catalogue_languages),
        "countries_covered": len(covered_countries),
        "countries_indexed": len(countries),
        "pan_african_records": sum(1 for r in catalogue if PAN_AFRICAN in r["countries"]),
        "hf_records": sum(1 for r in catalogue if r["hf_repo"]),
        "open_access": sum(1 for r in catalogue if r["access"] == "Open"),
        "open_and_transcribed": sum(
            1 for r in catalogue if r["access"] == "Open" and r["labelled"] == "Transcribed"
        ),
        "commercial_ok": sum(1 for r in catalogue if r["commercial"] == "Yes"),
        "by_task": facet("task"),
        "by_variety": facet("variety"),
        "by_access": facet("access"),
        "by_labelled": facet("labelled"),
        "by_quality": facet("quality"),
        "by_licence_class": facet("licence_class"),
        "by_region": region_rows,
        "top_languages": [
            {"name": lang["name"], "slug": lang["slug"], "datasets": lang["datasets"]}
            for lang in top_languages
        ],
    }


def render_text(stats: dict[str, Any]) -> str:
    lines = [
        "ngano catalogue statistics",
        "=" * 26,
        "",
        f"datasets                 {stats['datasets']}",
        f"  flagged unverified     {stats['datasets_unverified']} (excluded from every hours total)",
        f"  with a stated size     {stats['datasets_with_hours']}",
        f"  on the HuggingFace Hub {stats['hf_records']}",
        f"  open access            {stats['open_access']}",
        f"  open and transcribed   {stats['open_and_transcribed']}",
        f"  commercial use allowed {stats['commercial_ok']}",
        f"verified hours           {stats['hours_verified']:,.0f}",
        f"languages indexed        {stats['languages']}",
        f"countries covered        {stats['countries_covered']} of {stats['countries_indexed']} indexed",
        f"pan-African records      {stats['pan_african_records']}",
        "",
        "By region (hours exclude unverified records, datasets spanning several regions count once per region)",
    ]
    lines.append(f"  {'region':<16} {'datasets':>9} {'hours':>10} {'languages':>10}")
    for row in stats["by_region"]:
        lines.append(
            f"  {row['region']:<16} {row['datasets']:>9} {row['hours']:>10,.0f} {row['languages']:>10}"
        )
    for title, key in [
        ("By task", "by_task"),
        ("By variety", "by_variety"),
        ("By access", "by_access"),
        ("By labelling", "by_labelled"),
        ("By audio quality", "by_quality"),
        ("By licence class", "by_licence_class"),
    ]:
        lines.append("")
        lines.append(title)
        for name, count in stats[key].items():
            lines.append(f"  {name:<32} {count:>4}")
    lines.append("")
    lines.append("Most catalogued languages")
    for lang in stats["top_languages"]:
        lines.append(f"  {lang['name']:<32} {lang['datasets']:>4}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = parser.parse_args()
    stats = compute()
    print(json.dumps(stats, indent=2) if args.json else render_text(stats))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
