"""Campus licences: enquiries, joining a class with a code, the roster and shared projects."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..core import membership, new_id, org_active, require_csrf, require_user, services

router = APIRouter(dependencies=[Depends(require_csrf)])


class Enquiry(BaseModel):
    kind: str = "campus"
    institution: str = Field(min_length=2, max_length=200)
    contactName: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=200)
    phone: str = Field(default="", max_length=20)
    city: str = Field(default="", max_length=100)
    students: int = Field(default=0, ge=0, le=1_000_000)
    message: str = Field(default="", max_length=3000)
    website: str = ""  # a field people cannot see: bots fill it in


@router.post("/api/enquiries")
async def enquire(request: Request, body: Enquiry):
    s = services(request)
    if body.website:
        return {"ok": True}  # quietly drop spam
    if body.kind not in ("campus", "enterprise"):
        raise HTTPException(400, "Unknown enquiry type.")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", body.email):
        raise HTTPException(400, "Please enter a valid email address.")
    eid = new_id("enq")
    await s.db.run(
        """INSERT INTO enquiries (id, kind, institution, contact_name, email, phone, city, students, message,
           created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        eid, body.kind, body.institution, body.contactName, body.email, body.phone, body.city, body.students,
        body.message, s.now(),
    )  # fmt: skip
    note = (
        f"New {body.kind} enquiry from {body.institution} ({body.city or 'city not given'})\n"
        f"Contact: {body.contactName}, {body.email}, {body.phone or 'no phone'}\n"
        f"Students: {body.students or 'not given'}\n\n{body.message}"
    )
    # Only the owner is emailed: the form is public, so a reply to the typed-in address could be used to send
    # mail to strangers. The page itself tells the person what happens next.
    for owner in sorted(s.settings.owner_emails) or [s.settings.support_email]:
        await s.email.send(owner, f"MathMe {body.kind} enquiry: {body.institution}", note)
    return {"ok": True}


class Join(BaseModel):
    code: str = Field(min_length=4, max_length=40)


async def _seats_used(request: Request, org_id: str) -> dict[str, int]:
    s = services(request)
    rows = await s.db.all("SELECT role, COUNT(*) AS n FROM org_members WHERE org_id = ? GROUP BY role", org_id)
    used = {"teacher": 0, "student": 0}
    for r in rows:
        used[r["role"]] = int(r["n"])
    return used


@router.post("/api/campus/join")
async def join(request: Request, body: Join, user: dict = Depends(require_user)):
    s = services(request)
    code = await s.db.one("SELECT * FROM org_codes WHERE code = ?", body.code.strip().upper())
    if not code:
        raise HTTPException(404, "That code was not found. Check it with your teacher.")
    org = await s.db.one("SELECT * FROM orgs WHERE id = ?", code["org_id"])
    if not org_active(org, s.now()):
        raise HTTPException(400, "That class's licence is not active. Ask your teacher or school.")
    current = await membership(s, user["id"])
    if current and current["id"] == org["id"]:
        return {"ok": True, "role": current["role"]}
    if current and org_active(current, s.now()):
        raise HTTPException(400, f"You are already in {current['name']}. Leave it first.")
    used = await _seats_used(request, org["id"])
    seats = org["teacher_seats"] if code["role"] == "teacher" else org["student_seats"]
    if used[code["role"]] >= seats:
        raise HTTPException(400, f"All {seats} {code['role']} places in this licence are taken.")
    await s.db.run("DELETE FROM org_members WHERE user_id = ?", user["id"])  # leave an old, expired class
    await s.db.run(
        "INSERT INTO org_members (org_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
        org["id"],
        user["id"],
        code["role"],
        s.now(),
    )
    return {"ok": True, "role": code["role"], "org": org["name"]}


@router.post("/api/campus/leave")
async def leave(request: Request, user: dict = Depends(require_user)):
    s = services(request)
    await s.db.run("UPDATE projects SET shared_org_id = NULL WHERE owner_id = ?", user["id"])
    await s.db.run("DELETE FROM org_members WHERE user_id = ?", user["id"])
    return {"ok": True}


@router.get("/api/campus")
async def my_class(request: Request, user: dict = Depends(require_user)):
    s = services(request)
    org = await membership(s, user["id"])
    if not org:
        return {"org": None}
    teacher = org["role"] == "teacher"
    used = await _seats_used(request, org["id"])
    shared = await s.db.all(
        """SELECT p.id, p.name, p.objects, p.updated_at, p.has_thumb, u.name AS owner_name, u.id AS owner_id
           FROM projects p JOIN users u ON u.id = p.owner_id
           WHERE p.shared_org_id = ? ORDER BY p.updated_at DESC LIMIT 200""",
        org["id"],
    )
    result = {
        "org": {
            "id": org["id"],
            "name": org["name"],
            "status": org["status"],
            "active": org_active(org, s.now()),
            "endsAt": org["ends_at"],
            "seats": {"teacher": org["teacher_seats"], "student": org["student_seats"]},
            "used": used,
        },
        "role": org["role"],
        "projects": shared,
    }
    if teacher:
        result["codes"] = await s.db.all("SELECT code, role FROM org_codes WHERE org_id = ?", org["id"])
        result["members"] = await s.db.all(
            """SELECT u.id, u.name, u.email, m.role, m.joined_at FROM org_members m JOIN users u ON u.id = m.user_id
               WHERE m.org_id = ? ORDER BY m.role DESC, u.name""",
            org["id"],
        )
    return result


@router.delete("/api/campus/members/{user_id}")
async def remove_member(request: Request, user_id: str, user: dict = Depends(require_user)):
    s = services(request)
    org = await membership(s, user["id"])
    if not org or org["role"] != "teacher":
        raise HTTPException(403, "Only teachers can remove students.")
    target = await s.db.one("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?", org["id"], user_id)
    if not target or target["role"] != "student":
        raise HTTPException(400, "Only students can be removed here.")
    await s.db.run("UPDATE projects SET shared_org_id = NULL WHERE owner_id = ?", user_id)
    await s.db.run("DELETE FROM org_members WHERE org_id = ? AND user_id = ?", org["id"], user_id)
    return {"ok": True}
