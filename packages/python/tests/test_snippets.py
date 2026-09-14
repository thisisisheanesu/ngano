"""Checks on snippets.json, the code the website and MCP server serve for Python.

Every Python snippet is substituted with real values and compiled, so a snippet
that drifts from the shipped API fails here rather than in a user's terminal.
"""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Set

import pytest

import ngano

SNIPPETS_PATH = Path(__file__).resolve().parent.parent / "snippets.json"

#: Values substituted for the placeholder tokens, all real catalogue entries.
#: LANGUAGE is a BCP 47 tag, not a display name, because that is what filters take.
SUBSTITUTIONS: Dict[str, str] = {
    "{{LANGUAGE}}": "sna",
    "{{COUNTRY_ISO2}}": "ZW",
    "{{COUNTRY_NAME}}": "Zimbabwe",
    "{{DATASET_ID}}": "waxal-corpus-paper",
    "{{HF_REPO}}": "google/fleurs",
    "{{CONFIG}}": "sn_zw",
    "{{TASK}}": "ASR",
}

REQUIRED_KEYS = (
    "catalogue_filter",
    "stream_filter",
    "single_dataset",
    "language_page",
    "country_page",
    "dataset_page",
    "cli",
)


@pytest.fixture(scope="module")
def payload() -> Dict[str, Any]:
    """The parsed snippets.json document."""
    return json.loads(SNIPPETS_PATH.read_text(encoding="utf-8"))


def substitute(source: str) -> str:
    """Replace every placeholder token with a real value."""
    for token, value in SUBSTITUTIONS.items():
        source = source.replace(token, value)
    return source


def test_language_placeholder_is_documented_as_a_tag(payload: Dict[str, Any]) -> None:
    """The token is a tag, and the pack says so for the site and the MCP server."""
    docs = payload["placeholder_docs"]
    assert set(docs) == set(payload["placeholders"])
    assert all(text.strip() for text in docs.values())
    assert "BCP 47" in docs["{{LANGUAGE}}"]
    assert ngano.Catalogue().resolve_language(SUBSTITUTIONS["{{LANGUAGE}}"]) == "sna"


def test_header_matches_the_package(payload: Dict[str, Any]) -> None:
    assert payload["language"] == "python"
    assert payload["install"] == "pip install ngano"
    assert payload["install_audio"] == "pip install 'ngano[audio]'"
    assert payload["version"] == ngano.__version__


def test_every_required_snippet_is_present(payload: Dict[str, Any]) -> None:
    assert set(payload["snippets"]) == set(REQUIRED_KEYS)
    for name, source in payload["snippets"].items():
        assert source.strip(), name


def test_only_declared_placeholders_are_used(payload: Dict[str, Any]) -> None:
    declared: Set[str] = set(payload["placeholders"])
    assert declared == set(SUBSTITUTIONS)
    used: Set[str] = set()
    for source in payload["snippets"].values():
        used.update(re.findall(r"\{\{[A-Z_0-9]+\}\}", source))
    assert used <= declared, f"undeclared placeholders: {sorted(used - declared)}"
    assert used == declared, f"declared but never used: {sorted(declared - used)}"


def test_python_snippets_compile(payload: Dict[str, Any]) -> None:
    shell = set(payload.get("shell_snippets", []))
    for name, source in payload["snippets"].items():
        if name in shell:
            continue
        compile(substitute(source), f"snippets.json:{name}", "exec")


def test_python_snippets_only_use_the_shipped_api(payload: Dict[str, Any]) -> None:
    shell = set(payload.get("shell_snippets", []))
    exported = set(ngano.__all__)
    for name, source in payload["snippets"].items():
        if name in shell:
            continue
        tree = ast.parse(substitute(source))
        imported: List[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                assert node.module == "ngano", f"{name} imports {node.module}"
                imported.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    assert alias.name == "ngano", f"{name} imports {alias.name}"
        assert imported, f"{name} imports nothing from ngano"
        for symbol in imported:
            assert symbol in exported, f"{name} imports {symbol}, which ngano does not export"


def test_cli_snippet_uses_real_commands(payload: Dict[str, Any]) -> None:
    from ngano.cli import build_parser

    commands = set(build_parser()._subparsers._group_actions[0].choices)  # type: ignore[union-attr]
    lines = [line.strip() for line in substitute(payload["snippets"]["cli"]).split("\n")]
    invocations = [line for line in lines if line.startswith("ngano ")]
    assert invocations
    for line in invocations:
        assert line.split()[1] in commands, line
    assert any(line.startswith("pip install ngano") for line in lines)


def test_catalogue_snippets_run_for_real(payload: Dict[str, Any]) -> None:
    """The offline snippets are executed, not just compiled."""
    for name in ("catalogue_filter", "country_page", "dataset_page"):
        source = substitute(payload["snippets"][name])
        if name == "dataset_page":
            # Drop the streaming tail; the rest of the snippet is offline.
            source = source.split("if record.hf_repo:")[0]
        exec(compile(source, f"snippets.json:{name}", "exec"), {"__name__": "__snippet__"})


def test_substituted_values_exist_in_the_catalogue() -> None:
    cat = ngano.Catalogue()
    assert cat.get(SUBSTITUTIONS["{{DATASET_ID}}"])
    assert cat.get(SUBSTITUTIONS["{{HF_REPO}}"])
    assert cat.country(SUBSTITUTIONS["{{COUNTRY_ISO2}}"]).name == SUBSTITUTIONS["{{COUNTRY_NAME}}"]
    language = cat.language(SUBSTITUTIONS["{{LANGUAGE}}"])
    assert language.tag == SUBSTITUTIONS["{{LANGUAGE}}"]
    assert language.datasets > 0
    assert cat.datasets(task=SUBSTITUTIONS["{{TASK}}"])
