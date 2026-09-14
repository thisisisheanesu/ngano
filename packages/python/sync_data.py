#!/usr/bin/env python3
"""Copy the ngano catalogue data files into the Python package.

The canonical data lives at the repository root in ``data/``. The published
wheel has to be usable offline, so a snapshot of five of those files is copied
into ``src/ngano/data/`` before a build. ``language_codes.json`` is the ISO
639-3 registry every language filter resolves through, so it ships too.

Run it by hand after the catalogue changes::

    python sync_data.py

or let the hatchling build hook in ``hatch_build.py`` run it automatically as
part of ``python -m build``. Pass ``--check`` in CI to fail when the bundled
snapshot has drifted from the repository data.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import List

#: Files copied from the repository ``data/`` directory into the package.
DATA_FILES: List[str] = [
    "catalogue.json",
    "countries.json",
    "languages.json",
    "language_codes.json",
    "field_map.json",
]

HERE = Path(__file__).resolve().parent
PACKAGE_DATA_DIR = HERE / "src" / "ngano" / "data"


def find_source_dir(start: Path | None = None) -> Path:
    """Locate the repository ``data/`` directory.

    Walks up from this file until a directory containing ``data/catalogue.json``
    is found.

    Args:
        start: Directory to start searching from. Defaults to this file's
            directory.

    Returns:
        The path of the repository ``data`` directory.

    Raises:
        FileNotFoundError: If no ``data/catalogue.json`` is found in any parent.
    """
    current = (start or HERE).resolve()
    for candidate in [current, *current.parents]:
        data_dir = candidate / "data"
        if (data_dir / "catalogue.json").is_file():
            return data_dir
    raise FileNotFoundError(
        "could not find a data/catalogue.json in any parent of " f"{current}"
    )


def sync(check: bool = False) -> int:
    """Copy (or verify) the bundled data snapshot.

    Args:
        check: When true, do not write anything. Report drift instead.

    Returns:
        A process exit code. ``0`` means success or no drift.
    """
    source_dir = find_source_dir()
    PACKAGE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    drifted: List[str] = []

    for name in DATA_FILES:
        source = source_dir / name
        target = PACKAGE_DATA_DIR / name
        if not source.is_file():
            print(f"missing source file: {source}", file=sys.stderr)
            return 1
        payload = source.read_bytes()
        json.loads(payload)  # fail loudly on a corrupt source file
        if check:
            if not target.is_file() or target.read_bytes() != payload:
                drifted.append(name)
            continue
        shutil.copyfile(source, target)
        print(f"synced {name} ({len(payload):,} bytes)")

    if check and drifted:
        print("bundled data is stale: " + ", ".join(drifted), file=sys.stderr)
        return 1
    if check:
        print("bundled data is up to date")
    return 0


def main() -> int:
    """Command line entry point for the sync script."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify the bundled snapshot instead of rewriting it",
    )
    args = parser.parse_args()
    return sync(check=args.check)


if __name__ == "__main__":
    raise SystemExit(main())
