"""Database access. Cloudflare D1 in production, SQLite locally; both speak the same SQL.

Only a tiny interface is used so the two can be swapped:
    await db.run(sql, *params)          -> rows changed
    await db.one(sql, *params)          -> dict | None
    await db.all(sql, *params)          -> list[dict]
"""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any, Protocol

MIGRATIONS = Path(__file__).resolve().parents[2] / "migrations"


class Db(Protocol):
    async def run(self, sql: str, *params: Any) -> int: ...
    async def one(self, sql: str, *params: Any) -> dict | None: ...
    async def all(self, sql: str, *params: Any) -> list[dict]: ...


class SqliteDb:
    """Local and test database. One connection, guarded by a lock (FastAPI may use threads)."""

    def __init__(self, path: str | Path = ":memory:") -> None:
        self.conn = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.lock = threading.Lock()

    async def run(self, sql: str, *params: Any) -> int:
        with self.lock:
            return self.conn.execute(sql, params).rowcount

    async def one(self, sql: str, *params: Any) -> dict | None:
        with self.lock:
            row = self.conn.execute(sql, params).fetchone()
        return dict(row) if row else None

    async def all(self, sql: str, *params: Any) -> list[dict]:
        with self.lock:
            return [dict(r) for r in self.conn.execute(sql, params).fetchall()]

    def migrate(self, folder: Path = MIGRATIONS) -> None:
        """Apply the SQL migrations once each (production D1 uses `wrangler d1 migrations apply`)."""
        with self.lock:
            self.conn.execute("CREATE TABLE IF NOT EXISTS d1_migrations (name TEXT PRIMARY KEY)")
            done = {r[0] for r in self.conn.execute("SELECT name FROM d1_migrations")}
            for f in sorted(folder.glob("*.sql")):
                if f.name in done:
                    continue
                self.conn.executescript(f.read_text())
                self.conn.execute("INSERT INTO d1_migrations (name) VALUES (?)", (f.name,))


def _to_js(value: Any) -> Any:
    """D1 refuses JavaScript `undefined`, which is what Python None becomes: send null instead."""
    if value is None:
        try:  # pragma: no cover - only inside the Workers runtime
            from pyodide.ffi import jsnull  # type: ignore

            return jsnull
        except ImportError:  # pragma: no cover
            from js import JSON  # type: ignore

            return JSON.parse("null")
    if isinstance(value, bool):
        return int(value)
    return value


class D1Db:  # pragma: no cover - needs the Workers runtime; covered by the deploy checklist
    """Cloudflare D1 binding (env.DB)."""

    def __init__(self, binding: Any) -> None:
        self.d1 = binding

    def _stmt(self, sql: str, params: tuple) -> Any:
        stmt = self.d1.prepare(sql)
        return stmt.bind(*[_to_js(p) for p in params]) if params else stmt

    async def run(self, sql: str, *params: Any) -> int:
        result = await self._stmt(sql, params).run()
        meta = result.meta.to_py() if hasattr(result.meta, "to_py") else result.meta
        return int(meta.get("changes", 0))

    async def one(self, sql: str, *params: Any) -> dict | None:
        row = await self._stmt(sql, params).first()
        if row is None or (hasattr(row, "typeof") and row.typeof == "undefined"):
            return None
        return row.to_py() if hasattr(row, "to_py") else dict(row)

    async def all(self, sql: str, *params: Any) -> list[dict]:
        result = await self._stmt(sql, params).all()
        rows = result.results
        rows = rows.to_py() if hasattr(rows, "to_py") else rows
        return [dict(r) for r in rows]
