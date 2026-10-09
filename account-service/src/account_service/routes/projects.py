"""Cloud projects: the project JSON and its thumbnail in R2, a row per project in D1."""

from __future__ import annotations

import base64
import json

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .. import plans
from ..core import membership, org_active, plan_in_force, require_csrf, require_user, services

router = APIRouter(dependencies=[Depends(require_csrf)])


def _key(project_id: str, user_id: str) -> str:
    return f"projects/{user_id}/{project_id}.json"


def _thumb_key(project_id: str, user_id: str) -> str:
    return f"thumbs/{user_id}/{project_id}.jpg"


def _row(p: dict) -> dict:
    return {
        "id": p["id"],
        "name": p["name"],
        "objects": p["objects"],
        "bytes": p["bytes"],
        "version": p["version"],
        "updatedAt": p["updated_at"],
        "hasThumb": bool(p["has_thumb"]),
        "shared": bool(p["shared_org_id"]),
    }


@router.get("/api/projects")
async def list_projects(request: Request, user: dict = Depends(require_user)):
    s = services(request)
    rows = await s.db.all("SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC", user["id"])
    force = await plan_in_force(s, user)
    return {"projects": [_row(r) for r in rows], "limit": force["limits"]["cloudProjects"]}


async def _readable(request: Request, user: dict, project_id: str) -> dict:
    """Own projects, or projects shared to the user's Campus class."""
    s = services(request)
    p = await s.db.one("SELECT * FROM projects WHERE id = ?", project_id)
    if not p:
        raise HTTPException(404, "That project was not found.")
    if p["owner_id"] == user["id"]:
        return p
    org = await membership(s, user["id"])
    if p["shared_org_id"] and org and org["id"] == p["shared_org_id"] and org_active(org, s.now()):
        return p
    raise HTTPException(404, "That project was not found.")


@router.get("/api/projects/{project_id}")
async def get_project(request: Request, project_id: str, user: dict = Depends(require_user)):
    s = services(request)
    p = await _readable(request, user, project_id)
    data = await s.bucket.get(_key(project_id, p["owner_id"]))
    if data is None:
        raise HTTPException(404, "The project file is missing.")
    return {**_row(p), "readOnly": p["owner_id"] != user["id"], "data": json.loads(data)}


@router.get("/api/projects/{project_id}/thumb")
async def get_thumb(request: Request, project_id: str, user: dict = Depends(require_user)):
    s = services(request)
    p = await _readable(request, user, project_id)
    data = await s.bucket.get(_thumb_key(project_id, p["owner_id"])) if p["has_thumb"] else None
    if data is None:
        raise HTTPException(404, "No picture yet.")
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=60"})


class SaveProject(BaseModel):
    name: str = Field(max_length=200)
    objects: int = Field(ge=0)
    #: the version this save is based on (0 for a new cloud project)
    baseVersion: int = Field(ge=0)
    data: dict
    #: a small JPEG as a data URL
    thumb: str | None = Field(default=None, max_length=400_000)
    force: bool = False


@router.put("/api/projects/{project_id}")
async def save_project(request: Request, project_id: str, body: SaveProject, user: dict = Depends(require_user)):
    s = services(request)
    if not project_id.replace("_", "").replace("-", "").isalnum() or len(project_id) > 64:
        raise HTTPException(400, "Bad project id.")
    limits = (await plan_in_force(s, user))["limits"]
    raw = json.dumps(body.data, separators=(",", ":")).encode()
    if len(raw) > limits["projectBytes"]:
        raise HTTPException(
            402,
            f"This project is {len(raw) // 1_000_000} MB, more than your plan's "
            f"{limits['projectBytes'] // 1_000_000} MB for one project. Upgrade to save bigger projects in the cloud.",
        )
    existing = await s.db.one("SELECT * FROM projects WHERE id = ?", project_id)
    now = s.now()
    if existing and existing["owner_id"] != user["id"]:
        raise HTTPException(404, "That project was not found.")
    if not existing:
        count = await s.db.one("SELECT COUNT(*) AS n FROM projects WHERE owner_id = ?", user["id"])
        if not plans.within(limits["cloudProjects"], int(count["n"])):
            raise HTTPException(
                402,
                f"Your plan keeps {limits['cloudProjects']} projects in the cloud. This one stays on this device; "
                "upgrade to keep more in the cloud.",
            )
    elif existing["version"] != body.baseVersion and not body.force:
        raise HTTPException(
            409,
            {"message": "This project was changed somewhere else.", "version": existing["version"]},
        )
    version = (existing["version"] if existing else 0) + 1
    await s.bucket.put(_key(project_id, user["id"]), raw, "application/json")
    has_thumb = existing["has_thumb"] if existing else 0
    if body.thumb and body.thumb.startswith("data:image/jpeg;base64,"):
        try:
            jpeg = base64.b64decode(body.thumb.split(",", 1)[1], validate=True)
        except ValueError as err:
            raise HTTPException(400, "The project picture is damaged.") from err
        await s.bucket.put(_thumb_key(project_id, user["id"]), jpeg, "image/jpeg")
        has_thumb = 1
    if existing:
        await s.db.run(
            """UPDATE projects SET name = ?, objects = ?, bytes = ?, version = ?, has_thumb = ?, updated_at = ?
               WHERE id = ?""",
            body.name, body.objects, len(raw), version, has_thumb, now, project_id,
        )  # fmt: skip
    else:
        await s.db.run(
            """INSERT INTO projects (id, owner_id, name, objects, bytes, version, has_thumb, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            project_id, user["id"], body.name, body.objects, len(raw), version, has_thumb, now, now,
        )  # fmt: skip
    return {"id": project_id, "version": version, "updatedAt": now}


@router.delete("/api/projects/{project_id}")
async def delete_project(request: Request, project_id: str, user: dict = Depends(require_user)):
    s = services(request)
    p = await s.db.one("SELECT * FROM projects WHERE id = ? AND owner_id = ?", project_id, user["id"])
    if p:
        await s.bucket.delete(_key(project_id, user["id"]))
        await s.bucket.delete(_thumb_key(project_id, user["id"]))
        await s.db.run("DELETE FROM projects WHERE id = ?", project_id)
    return {"ok": True}


class Share(BaseModel):
    shared: bool


@router.post("/api/projects/{project_id}/share")
async def share_project(request: Request, project_id: str, body: Share, user: dict = Depends(require_user)):
    """Share a cloud project with the user's Campus class (or stop sharing)."""
    s = services(request)
    p = await s.db.one("SELECT * FROM projects WHERE id = ? AND owner_id = ?", project_id, user["id"])
    if not p:
        raise HTTPException(404, "Save the project to the cloud first.")
    org = await membership(s, user["id"])
    if body.shared and not org_active(org, s.now()):
        raise HTTPException(400, "Join a Campus class first.")
    await s.db.run(
        "UPDATE projects SET shared_org_id = ? WHERE id = ?", org["id"] if body.shared and org else None, project_id
    )
    return {"shared": body.shared}
