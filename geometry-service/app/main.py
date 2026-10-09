"""FastAPI application entry point."""

from __future__ import annotations

import asyncio
import hmac
import io
import math
import re
import zipfile
from dataclasses import asdict
from typing import Annotated, Literal

import trimesh
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from . import __version__, assistant, geometry
from .settings import settings

app = FastAPI(
    title="MathMe Geometry Service",
    version=__version__,
    description="Measurements, boolean operations and print-ready exports for MathMe 3D Studio.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Notes"],
)


@app.middleware("http")
async def require_secret(request: Request, call_next):
    """With GEOMETRY_SECRET set, only callers that know it (the account service) get past /health."""
    secret = settings.geometry_secret
    if secret and request.method != "OPTIONS" and request.url.path != "/health":
        given = request.headers.get("x-geometry-secret", "")
        if not hmac.compare_digest(given.encode(), secret.encode()):
            return JSONResponse(status_code=401, content={"detail": "This service only answers MathMe."})
    return await call_next(request)


@app.exception_handler(geometry.GeometryError)
async def geometry_error_handler(_request: Request, exc: geometry.GeometryError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})


async def read_upload(upload: UploadFile, limit: int | None = None) -> bytes:
    """Read an uploaded file, stopping as soon as it is bigger than the limit."""
    limit = limit or settings.max_upload_bytes
    chunks: list[bytes] = []
    size = 0
    while chunk := await upload.read(1024 * 1024):
        size += len(chunk)
        if size > limit:
            raise HTTPException(413, f"The file is bigger than {settings.max_upload_mb:g} MB.")
        chunks.append(chunk)
    return b"".join(chunks)


async def run_limited(fn, *args):
    """Run heavy geometry work in a worker thread, with a time limit."""
    try:
        return await asyncio.wait_for(run_in_threadpool(fn, *args), timeout=settings.timeout_s)
    except TimeoutError as exc:
        raise HTTPException(504, "That took too long. Try a simpler model.") from exc


class Bounds(BaseModel):
    min: list[float]
    max: list[float]
    size: list[float]


class AnalyzeResponse(BaseModel):
    parts: int
    solid_parts: int
    open_parts: int
    triangles: int
    volume: float | None
    volume_sum: float
    overlap_volume: float | None
    surface_area: float
    bounds: Bounds
    is_watertight: bool
    bodies: int | None
    notes: list[str]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__, "assistant": assistant.available()}


@app.post("/assist", response_model=assistant.AssistResponse)
async def assist(request: assistant.AssistRequest) -> assistant.AssistResponse:
    """Turn a student's request into MathMe recipes with a Claude model (see app/assistant.py)."""
    if not assistant.available():
        raise HTTPException(503, "The chat helper needs an AI key on the geometry service.")
    try:
        return await asyncio.wait_for(run_in_threadpool(assistant.ask, request), timeout=settings.timeout_s)
    except TimeoutError as err:
        raise HTTPException(504, "The chat helper took too long to answer. Try again.") from err
    except assistant.AssistantUnavailable as err:
        raise HTTPException(503, str(err)) from err
    except Exception as err:  # network or API problems: the web app falls back to its own reader
        raise HTTPException(502, "The chat helper could not be reached. Try again in a moment.") from err


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(file: Annotated[UploadFile, File(description="GLB model in world coordinates")]):
    data = await read_upload(file)

    def work():
        result = geometry.analyze(geometry.load_parts(data, settings), settings)
        d = asdict(result)
        d["bounds"] = {"min": d.pop("bounds_min"), "max": d.pop("bounds_max"), "size": d.pop("size")}
        return d

    return await run_limited(work)


@app.post("/boolean")
async def boolean(
    a: Annotated[UploadFile, File(description="First shape (GLB)")],
    b: Annotated[UploadFile, File(description="Second shape (GLB)")],
    operation: Annotated[Literal["union", "difference", "intersection"], Form()],
):
    data_a = await read_upload(a)
    data_b = await read_upload(b, settings.max_upload_bytes - len(data_a) or 1)

    def work() -> bytes:
        parts_a = geometry.load_parts(data_a, settings)
        parts_b = geometry.load_parts(data_b, settings)
        return geometry.to_glb(geometry.boolean(parts_a, parts_b, operation, settings))

    glb = await run_limited(work)
    return Response(glb, media_type="model/gltf-binary")


def _vec3(text: str, what: str) -> list[float]:
    try:
        values = [float(v) for v in text.split(",")]
    except ValueError as exc:
        raise HTTPException(422, f"{what} must be three numbers like 0,1,0.") from exc
    if len(values) != 3 or not all(map(math.isfinite, values)):
        raise HTTPException(422, f"{what} must be three numbers like 0,1,0.")
    return values


@app.post("/slice")
async def slice_model(
    file: Annotated[UploadFile, File(description="GLB model in world coordinates")],
    point: Annotated[str, Form(description="A point on the cutting plane: x,y,z")],
    normal: Annotated[str, Form(description="Direction at right angles to the plane: x,y,z")],
    scale: Annotated[
        float, Form(gt=0, le=10000, description="Scale for the STL files (e.g. 10 for cm to mm)")
    ] = 1.0,
    name: Annotated[str, Form(max_length=200)] = "cut",
):
    """Cut a model into two halves with closed cut faces.

    Returns a zip with both halves as one GLB, and one STL per half.
    """
    data = await read_upload(file)
    p = _vec3(point, "point")
    n = _vec3(normal, "normal")

    def work() -> tuple[bytes, int]:
        parts = geometry.load_parts(data, settings)
        pos, neg, open_count = geometry.slice_parts(parts, p, n)
        buf = io.BytesIO()
        safe = _safe_name(name)
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(f"{safe}-both-halves.glb", geometry.halves_glb(pos, neg))
            for label, half in (("side-A", pos), ("side-B", neg)):
                mesh = trimesh.util.concatenate(half)
                mesh.apply_scale(scale)
                z.writestr(f"{safe}-{label}.stl", geometry.export_mesh(mesh, "stl"))
            z.writestr(
                "README.txt",
                f"Cut through point ({', '.join(map(str, p))}) with normal ({', '.join(map(str, n))}).\n"
                "Side A is the half the normal points to. GLB is in the model's own units; "
                f"STL files are scaled by {scale}.\n"
                + (
                    f"{open_count} open part(s) were trimmed without a closed cut face.\n"
                    if open_count
                    else ""
                ),
            )
        return buf.getvalue(), open_count

    content, open_count = await run_limited(work)
    headers = {"Content-Disposition": f'attachment; filename="{_safe_name(name)}.zip"'}
    if open_count:
        headers["X-Notes"] = f"{open_count} open part(s) were trimmed without a closed cut face."
    return Response(content, media_type="application/zip", headers=headers)


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-")[:60] or "model"


@app.post("/export")
async def export(
    file: Annotated[UploadFile, File(description="GLB model in world coordinates")],
    format: Annotated[Literal["stl", "obj", "ply", "3mf"], Form()] = "stl",
    scale: Annotated[float, Form(gt=0, le=10000)] = 1.0,
    union: Annotated[bool, Form()] = True,
    repair: Annotated[bool, Form()] = True,
    name: Annotated[str, Form(max_length=200)] = "model",
):
    data = await read_upload(file)

    def work() -> tuple[bytes, list[str]]:
        parts = geometry.load_parts(data, settings)
        mesh, notes = geometry.print_ready(parts, union=union, repair=repair, scale=scale, settings=settings)
        return geometry.export_mesh(mesh, format), notes

    content, notes = await run_limited(work)
    headers = {"Content-Disposition": f'attachment; filename="{_safe_name(name)}.{format}"'}
    if notes:
        headers["X-Notes"] = " ".join(notes).encode("ascii", "ignore").decode()
    return Response(content, media_type=geometry.EXPORT_FORMATS[format], headers=headers)
