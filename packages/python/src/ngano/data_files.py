"""Access to the catalogue snapshot bundled inside the installed package.

The wheel ships ``catalogue.json``, ``countries.json``, ``languages.json``,
``language_codes.json`` and ``field_map.json`` under ``ngano/data/``. They are copied from the repository
root at build time by ``sync_data.py``, which the hatchling hook in
``hatch_build.py`` runs for you. Everything here works offline.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Union

from .errors import CatalogueError

__all__ = ["read_json", "data_path", "SNAPSHOT_FILES"]

#: The files bundled with the package.
SNAPSHOT_FILES = (
    "catalogue.json",
    "countries.json",
    "languages.json",
    "language_codes.json",
    "field_map.json",
)

_CACHE: Dict[str, Any] = {}


def data_path(name: str) -> Path:
    """Return the filesystem path of a bundled data file.

    Args:
        name: A file name such as ``"catalogue.json"``.

    Returns:
        The path inside the installed package.

    Raises:
        CatalogueError: If the file is not present in the installation.
    """
    path = Path(__file__).resolve().parent / "data" / name
    if not path.is_file():
        raise CatalogueError(
            f"the bundled data file {name!r} is missing from this ngano "
            "installation. Run sync_data.py and rebuild the package."
        )
    return path


def read_json(name: str) -> Union[Dict[str, Any], List[Any]]:
    """Read and cache one bundled JSON file.

    Args:
        name: A file name such as ``"catalogue.json"``.

    Returns:
        The parsed JSON document. The same object is returned on later calls,
        so callers must not mutate it.

    Raises:
        CatalogueError: If the file is missing or is not valid JSON.

    Example:
        >>> isinstance(read_json("field_map.json"), dict)
        True
    """
    if name in _CACHE:
        cached: Union[Dict[str, Any], List[Any]] = _CACHE[name]
        return cached
    path = data_path(name)
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except json.JSONDecodeError as exc:
        raise CatalogueError(f"the bundled data file {name!r} is not valid JSON") from exc
    _CACHE[name] = payload
    result: Union[Dict[str, Any], List[Any]] = payload
    return result
