"""Everything a request handler needs, built once per process (locally) or per Worker isolate."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from .cashfree import Cashfree
from .db import Db
from .emailer import Emailer
from .http import Http
from .settings import Settings
from .storage import Bucket


@dataclass
class Services:
    settings: Settings
    db: Db
    bucket: Bucket
    http: Http
    clock: Callable[[], int] = field(default=lambda: int(time.time()))
    email: Emailer = None  # type: ignore[assignment]
    cashfree: Cashfree = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.email is None:
            self.email = Emailer(self.settings, self.http)
        if self.cashfree is None:
            self.cashfree = Cashfree(self.settings, self.http)

    def now(self) -> int:
        return self.clock()


def local_services(settings: Settings) -> Services:
    """uvicorn / tests: SQLite file + a local folder."""
    from .db import SqliteDb
    from .http import HttpxHttp
    from .storage import LocalBucket

    db = SqliteDb(settings.db_path)
    db.migrate()
    return Services(settings, db, LocalBucket(settings.bucket_dir), HttpxHttp())


_worker_cache: dict[int, Services] = {}


def worker_services(env: Any) -> Services:  # pragma: no cover - needs the Workers runtime
    """Cloudflare: D1 (env.DB), R2 (env.PROJECTS), fetch; settings from vars and secrets."""
    key = id(env)
    if key not in _worker_cache:
        from .db import D1Db
        from .http import WorkersHttp
        from .storage import R2Bucket

        class EnvView:
            def get(self, name: str) -> Any:
                v = getattr(env, name, None)
                return None if v is None or (hasattr(v, "typeof") and v.typeof == "undefined") else v

        settings = Settings.from_env(EnvView())
        _worker_cache.clear()
        _worker_cache[key] = Services(settings, D1Db(env.DB), R2Bucket(env.PROJECTS), WorkersHttp())
    return _worker_cache[key]
