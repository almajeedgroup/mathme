"""FastAPI application entry point."""

from __future__ import annotations

import asyncio
import re
from dataclasses import asdict
from typing import Annotated, Literal

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from . import __version__, geometry
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
    return {"status": "ok", "version": __version__}


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
