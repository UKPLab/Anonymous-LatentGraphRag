"""IO and hashing helpers."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any


def compute_mdhash_id(content: str, prefix: str = "") -> str:
    """MD5 of ``content`` with optional ``prefix``. Matches the legacy hipporag scheme."""
    return prefix + hashlib.md5(content.encode("utf-8")).hexdigest()


def ensure_dir(path: str | os.PathLike) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def read_json(path: str | os.PathLike) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(obj: Any, path: str | os.PathLike, *, indent: int = 2) -> None:
    ensure_dir(Path(path).parent)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=indent, ensure_ascii=False)
