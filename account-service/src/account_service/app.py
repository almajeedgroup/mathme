"""The MathMe account API (FastAPI). Runs on Cloudflare Workers (see entry.py) or locally with uvicorn."""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from . import __version__
from .routes import admin, auth, billing, campus, projects, usage
from .services import Services, local_services
from .settings import Settings

log = logging.getLogger("mathme")


def create_app(svc: Services | None = None) -> FastAPI:
    app = FastAPI(title="MathMe accounts", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.services = svc
    for module in (auth, projects, billing, campus, admin):
        app.include_router(module.router)
    app.include_router(usage.router)  # last: it has a catch-all /api/{route} for the geometry service

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception):  # pragma: no cover - safety net
        log.exception("unexpected error on %s", request.url.path)
        return JSONResponse({"detail": "Something went wrong on our side. Please try again."}, status_code=500)

    return app


def _local() -> FastAPI:
    """`uvicorn account_service.app:app` reads settings from the environment (SQLite + a local folder)."""
    settings = Settings.from_env(os.environ)
    return create_app(local_services(settings))


class _Lazy:
    """Build the local app only when uvicorn asks for it (importing this module stays cheap)."""

    _app: FastAPI | None = None

    async def __call__(self, scope, receive, send):
        if self._app is None:
            self._app = _local()
        await self._app(scope, receive, send)


app = _Lazy()
