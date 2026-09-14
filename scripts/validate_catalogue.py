#!/usr/bin/env python3
"""Validate data/catalogue.json against data/schema.json plus ngano's semantic rules.

The structural pass implements the subset of JSON Schema 2020-12 that
data/schema.json actually uses, so this script runs with no third-party
packages installed. When the `jsonschema` package is importable it is run as
well, as a second opinion.

The semantic pass checks the things a schema cannot express:

* ids are unique
* every country name resolves against data/countries.json (or is Pan-African)
* country_codes are exactly the iso2 codes of `countries`, in order
* regions are exactly the regions implied by `countries`
* languages_clean is a subset of languages by count, is duplicate free, and
  every name in it resolves against data/languages.json
* URLs are well formed and use http(s)
* controlled vocabularies are respected (via the schema enums)
* hours / hours_num agree about being present, and unverified_size is set on
  exactly the records at or above the 20,000 hour self-reported threshold
* hf_repo is present whenever the record claims a HuggingFace URL

Exits 0 when the catalogue is clean, 1 otherwise.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Self-reported sizes at or above this many hours are treated as unverified and
# excluded from every hours total in the project.
UNVERIFIED_HOURS_THRESHOLD = 20_000

PAN_AFRICAN = "Pan-African"


class Errors:
    """Collects failures so one run reports everything wrong, not just the first."""

    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, where: str, message: str) -> None:
        self.items.append(f"{where}: {message}")

    def __bool__(self) -> bool:
        return bool(self.items)

    def __len__(self) -> int:
        return len(self.items)


# --------------------------------------------------------------------------
# Structural validation: the JSON Schema subset used by data/schema.json
# --------------------------------------------------------------------------

_TYPES: dict[str, type | tuple[type, ...]] = {
    "object": dict,
    "array": list,
    "string": str,
    "boolean": bool,
    "null": type(None),
}


def _is_type(value: Any, name: str) -> bool:
    if name == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if name == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if name == "boolean":
        return isinstance(value, bool)
    expected = _TYPES.get(name)
    if expected is None:
        return False
    if expected is not bool and isinstance(value, bool):
        return expected is object
    return isinstance(value, expected)


def _resolve(ref: str, root: dict[str, Any]) -> dict[str, Any]:
    if not ref.startswith("#/"):
        raise ValueError(f"only local refs are supported, got {ref!r}")
    node: Any = root
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def _well_formed_uri(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc) and " " not in value


def validate_instance(value: Any, schema: dict[str, Any], root: dict[str, Any],
                      path: str, errors: Errors) -> None:
    """Validate `value` against `schema`, appending every failure to `errors`."""
    if "$ref" in schema:
        merged = dict(_resolve(schema["$ref"], root))
        merged.update({k: v for k, v in schema.items() if k != "$ref"})
        validate_instance(value, merged, root, path, errors)
        return

    if "oneOf" in schema:
        matches = 0
        for sub in schema["oneOf"]:
            probe = Errors()
            validate_instance(value, sub, root, path, probe)
            if not probe:
                matches += 1
        if matches != 1:
            errors.add(path, f"matched {matches} of the oneOf branches, expected exactly 1")
        return

    if "type" in schema:
        declared = schema["type"]
        names = [declared] if isinstance(declared, str) else list(declared)
        if not any(_is_type(value, n) for n in names):
            errors.add(path, f"expected type {'/'.join(names)}, got {type(value).__name__}")
            return

    if "enum" in schema and value not in schema["enum"]:
        errors.add(path, f"{value!r} is not one of the permitted values {schema['enum']}")
        return

    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.add(path, f"string shorter than {schema['minLength']} characters")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.add(path, f"string longer than {schema['maxLength']} characters")
        pattern = schema.get("pattern")
        if pattern and not re.fullmatch(pattern, value):
            errors.add(path, f"{value!r} does not match pattern {pattern}")
        if schema.get("format") == "uri" and not _well_formed_uri(value):
            errors.add(path, f"{value!r} is not a well formed http(s) URI")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.add(path, f"{value} is below the minimum {schema['minimum']}")

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.add(path, f"needs at least {schema['minItems']} items, has {len(value)}")
        if schema.get("uniqueItems") and len(value) != len({json.dumps(v, sort_keys=True) for v in value}):
            errors.add(path, "items must be unique")
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                validate_instance(item, item_schema, root, f"{path}[{index}]", errors)

    if isinstance(value, dict):
        properties = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in value:
                errors.add(path, f"missing required property {key!r}")
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in properties:
                    errors.add(path, f"unexpected property {key!r}")
        for key, sub in properties.items():
            if key in value:
                validate_instance(value[key], sub, root, f"{path}.{key}", errors)


def validate_structure(catalogue: list[dict[str, Any]], schema: dict[str, Any],
                       errors: Errors) -> None:
    validate_instance(catalogue, schema, schema, "catalogue", errors)


def cross_check_with_jsonschema(catalogue: Any, schema: dict[str, Any], errors: Errors) -> bool:
    """Run the `jsonschema` package too, if it is installed. Returns whether it ran."""
    try:
        import jsonschema  # type: ignore[import-not-found]
    except ImportError:
        return False
    validator_cls = jsonschema.validators.validator_for(schema)
    validator_cls.check_schema(schema)
    validator = validator_cls(schema)
    for failure in validator.iter_errors(catalogue):
        location = "catalogue" + "".join(f"[{p!r}]" for p in failure.absolute_path)
        errors.add(location, f"jsonschema: {failure.message}")
    return True


# --------------------------------------------------------------------------
# Semantic validation
# --------------------------------------------------------------------------

def validate_semantics(catalogue: list[dict[str, Any]], countries: list[dict[str, Any]],
                       languages: list[dict[str, Any]], errors: Errors) -> None:
    by_country = {c["name"]: c for c in countries}
    known_languages = {lang["name"] for lang in languages}

    seen_ids: dict[str, int] = {}
    for index, record in enumerate(catalogue):
        rid = record.get("id")
        where = f"catalogue[{index}] ({rid})"

        if not isinstance(rid, str):
            continue
        if rid in seen_ids:
            errors.add(where, f"duplicate id, first seen at index {seen_ids[rid]}")
        else:
            seen_ids[rid] = index

        # Countries resolve, and the derived fields are actually derived.
        named = [c for c in record.get("countries", []) if c != PAN_AFRICAN]
        for name in named:
            if name not in by_country:
                errors.add(where, f"country {name!r} does not resolve against countries.json")
        resolvable = [c for c in named if c in by_country]

        expected_codes = [by_country[c]["iso2"] for c in resolvable]
        if record.get("country_codes") != expected_codes:
            errors.add(where, f"country_codes {record.get('country_codes')} do not match "
                              f"the iso2 codes of countries ({expected_codes})")

        expected_regions = sorted({by_country[c]["region"] for c in resolvable})
        if sorted(set(record.get("regions", []))) != expected_regions:
            errors.add(where, f"regions {sorted(set(record.get('regions', [])))} do not match "
                              f"the regions of countries ({expected_regions})")

        # Language fields. languages_clean is a filtered view of languages: names the
        # index does not cover are dropped rather than guessed at, so it may be
        # shorter. Every name it does carry must resolve.
        languages_raw = record.get("languages", [])
        languages_clean = record.get("languages_clean", [])
        if len(languages_clean) > len(languages_raw):
            errors.add(where, f"languages_clean has {len(languages_clean)} entries, more than "
                              f"the {len(languages_raw)} in languages")
        for name in languages_clean:
            if name not in known_languages:
                errors.add(where, f"language {name!r} does not resolve against languages.json")
        if len(set(languages_clean)) != len(languages_clean):
            errors.add(where, "languages_clean contains duplicates")

        # Size fields.
        hours = record.get("hours")
        hours_num = record.get("hours_num")
        if (hours is None) != (hours_num is None):
            errors.add(where, "hours and hours_num must both be present or both be null")
        flagged = record.get("unverified_size")
        big = hours_num is not None and hours_num >= UNVERIFIED_HOURS_THRESHOLD
        if big and not flagged:
            errors.add(where, f"hours_num {hours_num} is at or above "
                              f"{UNVERIFIED_HOURS_THRESHOLD} but unverified_size is false")
        if flagged and not big:
            errors.add(where, f"unverified_size is true but hours_num is {hours_num}, "
                              f"below the {UNVERIFIED_HOURS_THRESHOLD} hour threshold")

        # Host and URL agreement.
        url = record.get("url")
        hf_repo = record.get("hf_repo")
        if url is None and record.get("notes", "").strip() == "":
            errors.add(where, "url is null and notes do not explain why")
        if isinstance(url, str) and "huggingface.co/datasets/" in url and not hf_repo:
            errors.add(where, "url points at a HuggingFace dataset but hf_repo is null")
        if isinstance(hf_repo, str) and isinstance(url, str):
            if hf_repo.lower() not in url.lower():
                errors.add(where, f"hf_repo {hf_repo!r} does not appear in url {url!r}")


# --------------------------------------------------------------------------

def load(path: Path) -> Any:
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        print(f"error: {path} not found", file=sys.stderr)
        raise SystemExit(1)
    except json.JSONDecodeError as exc:
        print(f"error: {path} is not valid JSON: {exc}", file=sys.stderr)
        raise SystemExit(1)


def report(errors: Errors, limit: int = 50) -> None:
    for line in errors.items[:limit]:
        print(f"  {line}", file=sys.stderr)
    if len(errors) > limit:
        print(f"  ... and {len(errors) - limit} more", file=sys.stderr)


def main(argv: Iterable[str]) -> int:
    catalogue = load(DATA / "catalogue.json")
    schema = load(DATA / "schema.json")
    countries = load(DATA / "countries.json")
    languages = load(DATA / "languages.json")

    if not isinstance(catalogue, list):
        print("error: catalogue.json must be a JSON array", file=sys.stderr)
        return 1

    errors = Errors()
    validate_structure(catalogue, schema, errors)
    used_jsonschema = cross_check_with_jsonschema(catalogue, schema, errors)
    validate_semantics(catalogue, countries, languages, errors)

    if errors:
        print(f"catalogue.json FAILED validation with {len(errors)} problem(s):", file=sys.stderr)
        report(errors)
        return 1

    verified = [r for r in catalogue if not r["unverified_size"]]
    total_hours = sum(r["hours_num"] or 0 for r in verified)
    engine = "built-in checker + jsonschema" if used_jsonschema else "built-in checker"
    print(f"catalogue.json OK: {len(catalogue)} records, "
          f"{len(catalogue) - len(verified)} flagged unverified, "
          f"{total_hours:,.0f} verified hours ({engine})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
