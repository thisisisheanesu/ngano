"""Exception types raised by ngano.

Every error raised on purpose by this package derives from :class:`NganoError`,
so a caller can wrap a whole pipeline in one ``except``.
"""

from __future__ import annotations

from typing import Optional

__all__ = [
    "NganoError",
    "DatasetNotFoundError",
    "GatedDatasetError",
    "MissingDependencyError",
    "CatalogueError",
    "LoaderError",
]


class NganoError(Exception):
    """Base class for every error raised by ngano."""


class CatalogueError(NganoError):
    """The catalogue snapshot or the live API could not be read."""


class DatasetNotFoundError(NganoError, KeyError):
    """No catalogue record matches the requested identifier.

    Subclasses :class:`KeyError` so that ``cat.get(...)`` behaves like a
    mapping lookup for callers that already catch ``KeyError``.
    """

    def __init__(self, dataset_id: str) -> None:
        """Store the identifier that failed to resolve.

        Args:
            dataset_id: The catalogue id or Hugging Face repo that was asked for.
        """
        self.dataset_id = dataset_id
        super().__init__(f"no dataset in the ngano catalogue with id {dataset_id!r}")

    def __str__(self) -> str:
        """Return the message without ``KeyError`` quoting."""
        return f"no dataset in the ngano catalogue with id {self.dataset_id!r}"


class LoaderError(NganoError):
    """A dataset could not be opened for streaming."""


class GatedDatasetError(LoaderError):
    """A Hugging Face repo requires access approval or a token.

    Raised instead of a raw ``401``/``403`` so the message names the repo and
    the page where access is requested.
    """

    def __init__(self, repo: str, detail: Optional[str] = None) -> None:
        """Build a gated-access message for a repo.

        Args:
            repo: The Hugging Face repo id, for example ``"google/fleurs"``.
            detail: Optional underlying error text to append.
        """
        self.repo = repo
        self.url = f"https://huggingface.co/datasets/{repo}"
        message = (
            f"access to the Hugging Face dataset {repo!r} was refused. "
            f"It is gated or private. Request access at {self.url} and then pass a "
            "token with load(..., hf_token=...) or set HF_TOKEN in the environment."
        )
        if detail:
            message = f"{message} Underlying error: {detail}"
        super().__init__(message)


class MissingDependencyError(NganoError, ImportError):
    """An optional dependency is needed for the requested operation."""

    def __init__(self, package: str, extra: str, purpose: str) -> None:
        """Name the missing package and the extra that installs it.

        Args:
            package: The importable package that is missing.
            extra: The ngano extra that provides it, for example ``"audio"``.
            purpose: What the caller was trying to do.
        """
        self.package = package
        self.extra = extra
        super().__init__(
            f"{purpose} needs the optional dependency {package!r}, which is not "
            f"installed. Install it with: pip install 'ngano[{extra}]'"
        )
