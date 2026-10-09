"""Numbers for the owner dashboard. Money in paise, before GST (GST is not MathMe's revenue)."""

from __future__ import annotations

from . import plans
from .core import DAY
from .services import Services


async def compute(s: Services) -> dict:
    now = s.now()
    one = s.db.one
    users = (await one("SELECT COUNT(*) AS n FROM users"))["n"]
    signups_7 = (await one("SELECT COUNT(*) AS n FROM users WHERE created_at >= ?", now - 7 * DAY))["n"]
    signups_30 = (await one("SELECT COUNT(*) AS n FROM users WHERE created_at >= ?", now - 30 * DAY))["n"]
    weekly_active = (await one("SELECT COUNT(*) AS n FROM users WHERE last_seen_at >= ?", now - 7 * DAY))["n"]

    # paying = a subscription paid up to now or later (cancelled ones count until their period ends)
    paying_rows = await s.db.all(
        """SELECT plan, period, COUNT(DISTINCT user_id) AS n FROM subscriptions
           WHERE status IN ('active', 'past_due', 'cancelled') AND current_period_end > ?
           GROUP BY plan, period""",
        now,
    )
    paying = {f"{r['plan']}_{r['period']}": int(r["n"]) for r in paying_rows}
    paying_users = (
        await one(
            """SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions
               WHERE status IN ('active', 'past_due', 'cancelled') AND current_period_end > ?""",
            now,
        )
    )["n"]
    # recurring revenue counts plans that will renew (not ones cancelled at period end)
    renewing = await s.db.all(
        """SELECT plan, period, COUNT(*) AS n FROM subscriptions
           WHERE status IN ('active', 'past_due') AND current_period_end > ? GROUP BY plan, period""",
        now,
    )
    mrr = 0
    for r in renewing:
        price = plans.price(r["plan"], r["period"])
        mrr += int(r["n"]) * (price if r["period"] == "monthly" else price // 12)
    paid_orgs = (await one("SELECT COUNT(*) AS n FROM orgs WHERE status = 'paid' AND ends_at > ?", now))["n"]
    pilot_orgs = (await one("SELECT COUNT(*) AS n FROM orgs WHERE status = 'pilot' AND ends_at > ?", now))["n"]
    mrr += int(paid_orgs) * (plans.price("campus", "annual") // 12)
    campus_members = (
        await one("SELECT COUNT(*) AS n FROM org_members m JOIN orgs o ON o.id = m.org_id WHERE o.ends_at > ?", now)
    )["n"]

    # churn: paid plans that ended in the last 30 days without renewing, over those paying 30 days ago
    ended = (
        await one(
            """SELECT COUNT(*) AS n FROM subscriptions
               WHERE status IN ('cancelled', 'expired') AND current_period_end BETWEEN ? AND ?""",
            now - 30 * DAY,
            now,
        )
    )["n"]
    paying_30_days_ago = (
        await one(
            """SELECT COUNT(*) AS n FROM subscriptions
               WHERE created_at <= ? AND current_period_end > ? AND status != 'pending'""",
            now - 30 * DAY,
            now - 30 * DAY,
        )
    )["n"]
    revenue_30 = (
        await one(
            "SELECT COALESCE(SUM(base), 0) AS v FROM payments WHERE status = 'paid' AND paid_at >= ?", now - 30 * DAY
        )
    )["v"]
    revenue_all = (await one("SELECT COALESCE(SUM(base), 0) AS v FROM payments WHERE status = 'paid'"))["v"]
    gst_all = (await one("SELECT COALESCE(SUM(cgst + sgst + igst), 0) AS v FROM payments WHERE status = 'paid'"))["v"]
    new_enquiries = (await one("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'"))["n"]
    return {
        "users": users,
        "signups7": signups_7,
        "signups30": signups_30,
        "weeklyActive": weekly_active,
        "payingUsers": paying_users,
        "paying": paying,
        "conversion": (paying_users / users) if users else 0,
        "mrr": mrr,
        "arr": mrr * 12,
        "churn30": (ended / paying_30_days_ago) if paying_30_days_ago else 0,
        "churned30": ended,
        "revenue30": revenue_30,
        "revenueAll": revenue_all,
        "gstCollected": gst_all,
        "campus": {"paid": paid_orgs, "pilot": pilot_orgs, "members": campus_members},
        "newEnquiries": new_enquiries,
    }
