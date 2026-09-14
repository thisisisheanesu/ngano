"""Run the docstring examples in every public module, offline."""

from __future__ import annotations

import doctest
import importlib
from types import ModuleType
from typing import List

import pytest

MODULES = [
    "ngano",
    "ngano.auth",
    "ngano.catalogue",
    "ngano.cli",
    "ngano.data_files",
    "ngano.errors",
    "ngano.filters",
    "ngano.languages",
    "ngano.loader",
    "ngano.mapping",
    "ngano.models",
]


@pytest.mark.parametrize("name", MODULES)
def test_module_docstrings(name: str) -> None:
    module: ModuleType = importlib.import_module(name)
    results = doctest.testmod(module, verbose=False, report=True)
    assert results.failed == 0, f"{results.failed} doctest failures in {name}"


def test_every_public_symbol_has_a_docstring() -> None:
    import ngano

    missing: List[str] = []
    for name in ngano.__all__:
        symbol = getattr(ngano, name)
        if name == "__version__":
            continue
        if not getattr(symbol, "__doc__", None):
            missing.append(name)
    assert missing == []
