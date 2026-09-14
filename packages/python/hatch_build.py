"""Hatchling build hook that refreshes the bundled catalogue snapshot.

Running ``python -m build`` (or ``pip install .``) from a checkout of the ngano
repository copies ``data/*.json`` into ``src/ngano/data/`` first, so the wheel
always ships a snapshot that matches the repository. Building from an sdist,
where the repository ``data/`` directory is absent, keeps the snapshot that was
packaged into the sdist.
"""

from __future__ import annotations

from typing import Any, Dict

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class SyncDataHook(BuildHookInterface):  # type: ignore[type-arg]
    """Copy the repository data files into the package before building."""

    PLUGIN_NAME = "ngano-sync-data"

    def initialize(self, version: str, build_data: Dict[str, Any]) -> None:
        """Run the data sync, tolerating a source tree without ``data/``."""
        import sys

        sys.path.insert(0, self.root)
        try:
            from sync_data import sync  # type: ignore[import-not-found]

            sync()
        except FileNotFoundError:
            self.app.display_warning(
                "ngano: repository data/ not found, keeping the bundled snapshot"
            )
        finally:
            if sys.path and sys.path[0] == self.root:
                sys.path.pop(0)
