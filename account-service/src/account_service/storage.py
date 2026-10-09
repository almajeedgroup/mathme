"""File storage for project files and thumbnails. Cloudflare R2 in production, a folder locally."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol


class Bucket(Protocol):
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...
    async def get(self, key: str) -> bytes | None: ...
    async def delete(self, key: str) -> None: ...


class LocalBucket:
    def __init__(self, folder: str | Path) -> None:
        self.root = Path(folder)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        safe = key.replace("..", "_").lstrip("/")
        return self.root / safe

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    async def get(self, key: str) -> bytes | None:
        p = self._path(key)
        return p.read_bytes() if p.exists() else None

    async def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class R2Bucket:  # pragma: no cover - needs the Workers runtime
    """Cloudflare R2 binding (env.PROJECTS)."""

    def __init__(self, binding: Any) -> None:
        self.r2 = binding

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        from js import Object, Uint8Array  # type: ignore
        from pyodide.ffi import to_js  # type: ignore

        body = Uint8Array.new(len(data))
        body.assign(data)
        opts = to_js({"httpMetadata": {"contentType": content_type}}, dict_converter=Object.fromEntries)
        await self.r2.put(key, body, opts)

    async def get(self, key: str) -> bytes | None:
        obj = await self.r2.get(key)
        if obj is None or (hasattr(obj, "typeof") and obj.typeof == "undefined"):
            return None
        buf = await obj.arrayBuffer()
        return bytes(buf.to_py())

    async def delete(self, key: str) -> None:
        await self.r2.delete(key)
