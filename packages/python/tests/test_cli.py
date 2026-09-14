"""Command line interface tests, driven through capsys."""

from __future__ import annotations

import json
from typing import Any, Dict, List

import pytest
from conftest import COMMON_VOICE_ROWS, CountingSource

from ngano import __version__
from ngano.cli import main


def run(argv: List[str], capsys: pytest.CaptureFixture[str]) -> Any:
    """Run the CLI and return its exit code and captured stdout."""
    code = main(argv)
    return code, capsys.readouterr().out


def test_no_command_prints_help(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run([], capsys)
    assert code == 2
    assert "usage: ngano" in out


def test_version_flag(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as excinfo:
        main(["--version"])
    assert excinfo.value.code == 0
    assert __version__ in capsys.readouterr().out


def test_search_text_output(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["search", "parliament", "--limit", "3"], capsys)
    assert code == 0
    assert "datasets" in out


def test_search_json_output(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["--json", "search", "fleurs", "--limit", "2"], capsys)
    assert code == 0
    payload = json.loads(out)
    assert isinstance(payload, list)
    assert len(payload) <= 2
    assert "id" in payload[0]


def test_search_with_filters_only(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(
        ["--json", "search", "--language", "Shona", "--task", "ASR", "--commercial"], capsys
    )
    assert code == 0
    records = json.loads(out)
    assert records
    for record in records:
        assert record["commercial"] == "Yes"


def test_show_text_and_json(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["show", "google/fleurs"], capsys)
    assert code == 0
    assert "google/fleurs" in out

    code, out = run(["--json", "show", "waxal-corpus-paper"], capsys)
    assert code == 0
    assert json.loads(out)["id"] == "waxal-corpus-paper"


def test_show_unknown_dataset_exits_one(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["--json", "show", "not-a-dataset"], capsys)
    assert code == 1
    assert json.loads(out)["error"]["type"] == "DatasetNotFoundError"


def test_countries_command(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["--json", "countries", "--region", "Southern Africa"], capsys)
    assert code == 0
    countries = json.loads(out)
    assert countries
    assert {c["region"] for c in countries} == {"Southern Africa"}
    assert any(c["iso2"] == "ZW" for c in countries)

    code, out = run(["countries"], capsys)
    assert code == 0
    assert "countries" in out


def test_languages_command(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["--json", "languages", "--min-datasets", "5", "--limit", "4"], capsys)
    assert code == 0
    languages = json.loads(out)
    assert 0 < len(languages) <= 4
    assert all(language["datasets"] >= 5 for language in languages)

    code, out = run(["languages", "--limit", "3"], capsys)
    assert code == 0
    assert "3 languages" in out


def test_stats_command(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["--json", "stats"], capsys)
    assert code == 0
    stats = json.loads(out)
    assert stats["datasets"] > 0
    assert "unverified" in stats

    code, out = run(["stats"], capsys)
    assert code == 0
    assert "unverified_size" in out


def test_load_dry_run_lists_repos(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(
        ["--json", "load", "--language", "Shona", "--hf-only", "--dry-run"], capsys
    )
    assert code == 0
    payload = json.loads(out)
    assert payload["loadable"] == payload["matched"]
    assert all(repo for repo in payload["datasets"])


def test_load_streams_rows_to_stdout(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from ngano import loader

    def fake_opener(repo: str, **kwargs: Any) -> Any:
        source = CountingSource(COMMON_VOICE_ROWS)
        return source, source.columns

    monkeypatch.setattr(loader, "open_streaming_dataset", fake_opener)
    code, out = run(["load", "--language", "Shona", "--hf-only", "--limit", "2"], capsys)
    assert code == 0
    lines = [line for line in out.strip().split("\n") if line.startswith("{")]
    assert len(lines) == 2
    row: Dict[str, Any] = json.loads(lines[0])
    assert row["transcript"] == "Mhoro nyika"
    assert "matched" not in row


def test_load_writes_jsonl(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], tmp_path: Any
) -> None:
    from ngano import loader

    def fake_opener(repo: str, **kwargs: Any) -> Any:
        source = CountingSource(COMMON_VOICE_ROWS)
        return source, source.columns

    monkeypatch.setattr(loader, "open_streaming_dataset", fake_opener)
    path = tmp_path / "out.jsonl"
    code, out = run(
        ["load", "--language", "Shona", "--hf-only", "--limit", "1", "--out", str(path)], capsys
    )
    assert code == 0
    assert "wrote 1 rows" in out
    assert json.loads(path.read_text(encoding="utf-8").strip())["transcript"]


def test_languages_command_lists_tags_with_codes_and_names(
    capsys: pytest.CaptureFixture[str]
) -> None:
    code, out = run(["languages", "--limit", "5"], capsys)
    assert code == 0
    first = out.strip().split("\n")[0].split()
    assert first[0] and first[1]  # the tag, then the bare ISO 639-3 code
    assert "5 languages" in out

    code, out = run(["--json", "languages", "--limit", "3"], capsys)
    assert code == 0
    languages = json.loads(out)
    for language in languages:
        assert language["tag"]
        assert language["iso639_3"] == language["tag"].split("-")[0]
        assert language["slug"] == language["tag"].lower()
        assert language["name"]


def test_search_by_tag_code_and_name_agree(capsys: pytest.CaptureFixture[str]) -> None:
    ids = []
    for value in ("sna", "SNA", "Shona"):
        code, out = run(["--json", "search", "--language", value], capsys)
        assert code == 0
        ids.append([record["id"] for record in json.loads(out)])
    assert ids[0] and ids[0] == ids[1] == ids[2]


def test_search_with_an_unresolvable_language_matches_nothing(
    capsys: pytest.CaptureFixture[str]
) -> None:
    code, out = run(["--json", "search", "--language", "xyzzy"], capsys)
    assert code == 0
    assert json.loads(out) == []


def test_include_varieties_widens_a_search(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["--json", "search", "--language", "eng"], capsys)
    narrow = {record["id"] for record in json.loads(out)}
    code, out = run(["--json", "search", "--language", "eng", "--include-varieties"], capsys)
    wide = {record["id"] for record in json.loads(out)}
    assert code == 0
    assert narrow < wide


def test_show_displays_the_language_tags(capsys: pytest.CaptureFixture[str]) -> None:
    code, out = run(["show", "google/fleurs"], capsys)
    assert code == 0
    assert "language_tags" in out
    assert "language_codes" in out

    code, out = run(["--json", "show", "google/fleurs"], capsys)
    payload = json.loads(out)
    assert payload["language_tags"]
    assert payload["language_codes"]
