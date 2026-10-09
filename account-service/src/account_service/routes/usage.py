"""Usage limits: export tickets, and the geometry service / AI chat behind daily quotas."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from .. import plans
from ..core import current_user, plan_in_force, require_csrf, require_user, services, use

router = APIRouter()


def _upgrade(message: str) -> HTTPException:
    return HTTPException(402, message)


class ExportTicket(BaseModel):
    format: str


@router.post("/api/usage/export", dependencies=[Depends(require_csrf)])
async def export_ticket(request: Request, body: ExportTicket, user: dict = Depends(require_user)):
    """Ask before an export: is this format in the plan, and is there export allowance left this month?"""
    s = services(request)
    force = await plan_in_force(s, user)
    limits = force["limits"]
    if body.format not in plans.catalogue()["exportFormats"]:
        raise HTTPException(400, "Unknown export format.")
    if body.format not in limits["exportFormats"]:
        label = plans.catalogue()["exportFormats"][body.format]
        raise _upgrade(f"{label} is not in the {plans.plan(force['plan'])['label']} plan. Upgrade to unlock it.")
    ok, used = await use(s, user["id"], "export", limits["exportsPerMonth"])
    if not ok:
        raise _upgrade(f"You have used all {limits['exportsPerMonth']} exports for this month. Upgrade for more.")
    return {"ok": True, "used": used, "limit": limits["exportsPerMonth"]}


# ---------------------------------------------------------------- geometry service and AI chat

GEOMETRY_ROUTES = {"analyze", "boolean", "slice", "export"}


async def _forward(request: Request, path: str, *, priority: bool) -> Response:
    s = services(request)
    headers = {k: v for k, v in request.headers.items() if k.lower() in {"content-type", "accept"}}
    if s.settings.geometry_secret:
        headers["X-Geometry-Secret"] = s.settings.geometry_secret
    if priority:
        headers["X-Priority"] = "1"
    url = f"{s.settings.geometry_origin}/{path}"
    if request.url.query:
        url += f"?{request.url.query}"
    body = await request.body() if request.method != "GET" else None
    try:
        r = await s.http.request(request.method, url, headers=headers, body=body)
    except Exception as err:  # the container is down or unreachable
        raise HTTPException(502, "The geometry service is not answering. Try again in a minute.") from err
    keep = {k: v for k, v in r.headers.items() if k.lower() in {"content-type", "content-disposition", "x-notes"}}
    return Response(r.body, status_code=r.status, headers=keep)


@router.get("/api/health")
async def health(request: Request):
    """The geometry service's health, passed through (the app uses it to switch tools on)."""
    return await _forward(request, "health", priority=False)


@router.post("/api/{route}", dependencies=[Depends(require_csrf)])
async def geometry_job(request: Request, route: str):
    if route not in GEOMETRY_ROUTES and route != "assist":
        raise HTTPException(404, "Not found")
    s = services(request)
    user = await current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to use this (it runs on MathMe's servers).")
    force = await plan_in_force(s, user)
    limits = force["limits"]
    kind, limit = (
        ("ai", limits["aiMessagesPerDay"]) if route == "assist" else ("geometry", limits["geometryJobsPerDay"])
    )
    ok, _ = await use(s, user["id"], kind, limit)
    if not ok:
        what = "AI chat messages" if kind == "ai" else "geometry jobs (join, cut, measure, print-ready)"
        raise _upgrade(f"You have used today's {limit} {what}. They reset tomorrow, or upgrade for more.")
    return await _forward(request, route, priority=bool(limits.get("priority")))
