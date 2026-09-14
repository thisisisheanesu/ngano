"""Lazy audio handle tests."""

from __future__ import annotations

import builtins
from typing import Any

import pytest

from ngano import AudioRef, NganoError
from ngano.errors import MissingDependencyError
from ngano.mapping import build_audio_ref


def test_inline_bytes_are_returned_as_they_are() -> None:
    ref = AudioRef(bytes=b"RIFFdata")
    assert ref.read() == b"RIFFdata"
    assert ref.is_resolvable


def test_local_path_is_read_from_disk(tmp_path: Any) -> None:
    path = tmp_path / "clip.wav"
    path.write_bytes(b"RIFF0000")
    ref = AudioRef(path=str(path))
    assert ref.read() == b"RIFF0000"
    assert ref.bytes == b"RIFF0000"  # cached after the first read


def test_a_path_that_is_really_a_url_becomes_the_url() -> None:
    ref = AudioRef(path="https://example.org/a.wav")
    assert ref.url == "https://example.org/a.wav"


def test_remote_read_sends_the_token_only_to_hugging_face(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = {}

    class FakeResponse:
        content = b"REMOTE"

        def raise_for_status(self) -> None:
            return None

    def fake_get(url: str, headers: Any = None, timeout: float = 0) -> FakeResponse:
        seen["url"] = url
        seen["headers"] = headers
        return FakeResponse()

    import requests

    monkeypatch.setattr(requests, "get", fake_get)

    hf = AudioRef(url="https://huggingface.co/datasets/x/a.wav", token="hf_secret")
    assert hf.read() == b"REMOTE"
    assert seen["headers"]["Authorization"] == "Bearer hf_secret"

    elsewhere = AudioRef(url="https://example.org/a.wav", token="hf_secret")
    assert elsewhere.read() == b"REMOTE"
    assert seen["headers"] == {}


def test_nothing_to_read_raises_a_clear_error() -> None:
    with pytest.raises(NganoError, match="nothing to read"):
        AudioRef().read()


def test_decode_without_soundfile_names_the_extra(monkeypatch: pytest.MonkeyPatch) -> None:
    real_import = builtins.__import__

    def blocked(name: str, *args: Any, **kwargs: Any) -> Any:
        if name == "soundfile":
            raise ImportError("no soundfile")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", blocked)
    ref = AudioRef(bytes=b"RIFF")
    with pytest.raises(MissingDependencyError) as excinfo:
        ref.decode()
    message = str(excinfo.value)
    assert "ngano[audio]" in message
    assert "soundfile" in message
    assert isinstance(excinfo.value, ImportError)


def test_decode_returns_samples_and_rate(monkeypatch: pytest.MonkeyPatch) -> None:
    pytest.importorskip("numpy")
    import sys
    import types

    module = types.ModuleType("soundfile")

    def fake_read(buffer: Any) -> Any:
        import numpy

        return numpy.zeros(4), 16000

    module.read = fake_read  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "soundfile", module)
    ref = AudioRef(bytes=b"RIFF")
    array, rate = ref.decode()
    assert rate == 16000
    assert len(array) == 4
    assert ref.sampling_rate == 16000


def test_build_audio_ref_handles_every_shape() -> None:
    assert build_audio_ref(None) is None
    assert build_audio_ref("clip.wav").path == "clip.wav"
    assert build_audio_ref(b"RAW").bytes == b"RAW"
    mapping = build_audio_ref({"path": "a.wav", "bytes": b"x", "sampling_rate": 8000})
    assert (mapping.path, mapping.bytes, mapping.sampling_rate) == ("a.wav", b"x", 8000)
    assert build_audio_ref({"array": [0.0], "sampling_rate": 16000}) is None

    class Decoder:
        path = "b.wav"
        sample_rate = 22050

    decoder = build_audio_ref(Decoder())
    assert decoder is not None
    assert (decoder.path, decoder.sampling_rate) == ("b.wav", 22050)


def test_nothing_is_fetched_when_a_row_is_built() -> None:
    ref = build_audio_ref({"path": "https://example.org/a.wav"})
    assert ref is not None
    assert ref.bytes is None  # no request was made
