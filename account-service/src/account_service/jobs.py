"""Daily housekeeping (a Cloudflare Cron Trigger runs it): renewal reminders and expiring old plans."""

from __future__ import annotations

import datetime as dt

from . import plans
from .core import DAY
from .gst import add_gst, rupees
from .services import Services


async def daily(s: Services) -> dict[str, int]:
    now = s.now()
    reminded = 0
    # yearly plans do not renew by themselves: remind 15 and 3 days before the end
    rows = await s.db.all(
        """SELECT sb.*, u.email FROM subscriptions sb JOIN users u ON u.id = sb.user_id
           WHERE sb.period = 'annual' AND sb.status = 'active' AND sb.current_period_end BETWEEN ? AND ?""",
        now,
        now + 15 * DAY,
    )
    for sub in rows:
        days_left = (int(sub["current_period_end"]) - now) // DAY
        mark = "15" if days_left > 3 else "3"
        if mark in sub["reminders_sent"].split(","):
            continue
        end = dt.datetime.fromtimestamp(int(sub["current_period_end"]), dt.UTC).strftime("%d %B %Y")
        label = plans.plan(sub["plan"])["label"]
        total = add_gst(plans.price(sub["plan"], "annual"), s.settings.seller_state, sub["billing_state"]).total
        await s.email.send(
            sub["email"],
            f"Your MathMe {label} year ends on {end}",
            f"Your MathMe {label} plan runs until {end}. To keep it, renew from Settings → Account "
            f"(₹{rupees(total)} including GST for another year).\n\nIf you do nothing, your account moves to Free "
            "and your projects stay safe.",
        )
        await s.db.run(
            "UPDATE subscriptions SET reminders_sent = ? WHERE id = ?",
            ",".join(filter(None, [sub["reminders_sent"], mark])),
            sub["id"],
        )
        reminded += 1
    expired = await s.db.run(
        """UPDATE subscriptions SET status = 'expired', updated_at = ?
           WHERE status IN ('active', 'past_due', 'cancelled') AND current_period_end <= ?""",
        now,
        now,
    )
    stale = await s.db.run(
        "UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE status = 'pending' AND created_at < ?",
        now,
        now - 2 * DAY,
    )
    orgs = await s.db.run("UPDATE orgs SET status = 'expired' WHERE status != 'expired' AND ends_at <= ?", now)
    return {"reminded": reminded, "expired": expired + stale, "orgsExpired": orgs}
