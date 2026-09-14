"""Hugging Face token resolution.

ngano itself needs no credentials: the catalogue is public and the API is
unauthenticated. A token is only ever used when streaming a gated Hugging Face
dataset.
"""

from __future__ import annotations

import os
from typing import Optional

__all__ = ["resolve_token", "TOKEN_ENV_VARS"]

#: Environment variables checked, in order, when no token is passed.
TOKEN_ENV_VARS = ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN")


def resolve_token(explicit: Optional[str] = None) -> Optional[str]:
    """Resolve the Hugging Face token to use.

    The order is: the explicit argument, then ``HF_TOKEN``, then
    ``HUGGING_FACE_HUB_TOKEN``, then anonymous access.

    Args:
        explicit: A token passed directly by the caller.

    Returns:
        The token, or ``None`` for anonymous access.

    Example:
        >>> resolve_token("hf_abc")
        'hf_abc'
    """
    if explicit:
        return explicit.strip() or None
    for name in TOKEN_ENV_VARS:
        value = os.environ.get(name)
        if value and value.strip():
            return value.strip()
    return None
