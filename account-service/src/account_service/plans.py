"""Plans and limits, from plans.json (a copy of the repository's shared/plans.json)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

UNLIMITED = -1
PLAN_ORDER = ["free", "plus", "pro"]


@lru_cache(maxsize=1)
def catalogue() -> dict[str, Any]:
    return json.loads((Path(__file__).parent / "plans.json").read_text())


def plan(name: str) -> dict[str, Any]:
    return catalogue()["plans"][name]


def limits(name: str) -> dict[str, Any]:
    return plan(name)["limits"]


def price(name: str, period: str) -> int:
    """Price before GST, in paise. Raises KeyError for a plan or period that is not sold."""
    return int(plan(name)["prices"][period])


def higher(a: str, b: str) -> str:
    return a if PLAN_ORDER.index(a) >= PLAN_ORDER.index(b) else b


def within(limit: int, used: int) -> bool:
    return limit == UNLIMITED or used < limit


def campus_plan(role: str) -> str:
    c = plan("campus")
    return c["teacherPlan"] if role == "teacher" else c["studentPlan"]
