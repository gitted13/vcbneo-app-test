"""In-memory result cache keyed by file mtimes."""
import numpy as np
import pandas as pd

from app.config import settings
from app.modules.ingestion.service import cache_key
from app.modules.reconciliation.engine import run_all

_cache: dict[str, dict] = {}


def clear_cache():
    _cache.clear()


def _convert(obj):
    if isinstance(obj, dict):
        return {k: _convert(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert(v) for v in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def get_results(date_labels: list[str], year: int) -> dict[str, dict]:
    key = cache_key() + f"|{'_'.join(date_labels)}|{year}"
    if key not in _cache:
        raw = run_all(settings.upload_dir, date_labels, year)
        _cache[key] = _convert(raw)
    return _cache[key]
