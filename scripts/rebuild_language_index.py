#!/usr/bin/env python3
"""Re-key the catalogue and the language index on ISO 639-3.

Every dataset gains `language_tags` (BCP 47, primary subtag always ISO 639-3) and
`language_codes` (the bare three-letter codes, deduplicated). The source's own
spellings stay in `languages` so nothing about provenance is lost.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
codes_doc = json.loads((ROOT / "data/language_codes.json").read_text(encoding="utf-8"))
CODES = codes_doc["codes"]
NAME_TO_TAG = codes_doc["name_to_tag"]

cat = json.loads((ROOT / "data/catalogue.json").read_text(encoding="utf-8"))
countries = json.loads((ROOT / "data/countries.json").read_text(encoding="utf-8"))
BY_NAME = {c["name"]: c for c in countries}

unmapped = 0
for rec in cat:
    tags: list[str] = []
    for name in rec.get("languages") or []:
        tag = NAME_TO_TAG.get(name)
        if not tag:
            unmapped += 1
            continue
        if tag not in tags:
            tags.append(tag)
    rec["language_tags"] = tags
    bare: list[str] = []
    for t in tags:
        b = t.split("-")[0]
        if b not in bare:
            bare.append(b)
    rec["language_codes"] = bare
    rec["languages_clean"] = [CODES[t]["name"] for t in tags]

(ROOT / "data/catalogue.json").write_text(
    json.dumps(cat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

# Rebuild the language index, keyed by tag.
index: dict[str, dict] = {}
for rec in cat:
    tags = rec["language_tags"]
    if not tags:
        continue
    hours = 0.0 if rec.get("unverified_size") else (rec.get("hours_num") or 0.0)
    per = hours / len(tags)
    for t in tags:
        meta = CODES[t]
        e = index.setdefault(t, {
            "tag": t, "iso639_3": meta["iso639_3"], "region": meta["region"],
            "name": meta["name"], "scope": meta.get("scope"), "type": meta.get("type"),
            "aliases": meta["aliases"], "slug": t.lower(),
            "datasets": 0, "hours": 0.0, "countries": [], "tasks": [],
        })
        e["datasets"] += 1
        e["hours"] += per
        for c in rec.get("countries") or []:
            if c != "Pan-African" and c not in e["countries"]:
                e["countries"].append(c)
        if rec.get("task") and rec["task"] not in e["tasks"]:
            e["tasks"].append(rec["task"])

out = []
for e in index.values():
    e["hours"] = round(e["hours"], 1)
    e["countries"].sort()
    e["tasks"].sort()
    e["country_codes"] = [BY_NAME[c]["iso2"] for c in e["countries"] if c in BY_NAME]
    out.append(e)
out.sort(key=lambda x: (-x["hours"], -x["datasets"], x["name"]))

(ROOT / "data/languages.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

print(f"catalogue records: {len(cat)}, language names with no tag: {unmapped}")
print(f"language index: {len(out)} tags, {sum(1 for e in out if e['region'])} regional varieties")
for e in out[:10]:
    print(f"  {e['tag']:8} {e['name']:28} {e['hours']:>9,.0f} h  {e['datasets']:>3} sets")
