"""ngano: an open catalogue and streaming loader for African-language speech data.

ngano (Shona: folk stories, the oral tradition) catalogues speech and text
corpora for African languages and streams many of them through one canonical
row schema, so a single loop can read across datasets that agree on nothing.

The catalogue ships inside the package, so this works offline and without a
Hugging Face token:

    >>> from ngano import Catalogue
    >>> cat = Catalogue()
    >>> shona = cat.datasets(language="sna", commercial=True, task="ASR")

Languages are BCP 47 tags whose primary subtag is an ISO 639-3 code, so Shona is
``sna`` and Nigerian English is ``eng-NG``. A filter also accepts a bare code or
any catalogued name, for example ``isiZulu``, and resolves it to a tag.

Streaming needs the network, but never materialises a dataset::

    from ngano import load
    stream = load(language=["sna", "nde"], commercial=True, limit=100)
    for row in stream:
        print(row.transcript, row.duration_s)

Catalogue data is CC-BY-4.0, the code is MIT. Figures are reproduced as each
source published them, and self-reported claims of 20,000 hours or more are
flagged in the catalogue and excluded from every total.
"""

from __future__ import annotations

from .auth import resolve_token
from .catalogue import DEFAULT_API_BASE, Catalogue, default_catalogue
from .errors import (
    CatalogueError,
    DatasetNotFoundError,
    GatedDatasetError,
    LoaderError,
    MissingDependencyError,
    NganoError,
)
from .filters import Filter
from .languages import (
    LanguageCode,
    LanguageRegistry,
    canonicalise_tag,
    default_registry,
    resolve_language,
    resolve_languages,
    slugify_name,
)
from .loader import INTERLEAVE_STRATEGIES, Stream, load, load_dataset
from .mapping import ColumnPlan, FieldMap, build_row, normalise_column
from .models import AudioRef, CountryRecord, DatasetRecord, LanguageRecord, Row

#: The installed package version, following semantic versioning.
__version__ = "0.1.0"

__all__ = [
    "AudioRef",
    "Catalogue",
    "CatalogueError",
    "ColumnPlan",
    "CountryRecord",
    "DEFAULT_API_BASE",
    "DatasetNotFoundError",
    "DatasetRecord",
    "FieldMap",
    "Filter",
    "GatedDatasetError",
    "INTERLEAVE_STRATEGIES",
    "LanguageCode",
    "LanguageRecord",
    "LanguageRegistry",
    "LoaderError",
    "MissingDependencyError",
    "NganoError",
    "Row",
    "Stream",
    "__version__",
    "build_row",
    "canonicalise_tag",
    "default_catalogue",
    "default_registry",
    "load",
    "load_dataset",
    "normalise_column",
    "resolve_language",
    "resolve_languages",
    "resolve_token",
    "slugify_name",
]
