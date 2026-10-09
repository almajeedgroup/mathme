"""Emails: receipts, renewal reminders and enquiry alerts. Resend in production, the log in development."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from .http import Http, post_json
from .settings import Settings

log = logging.getLogger("mathme.email")


@dataclass
class Email:
    to: str
    subject: str
    text: str


@dataclass
class Emailer:
    settings: Settings
    http: Http
    sent: list[Email] = field(default_factory=list)  # kept for tests and the console mode

    async def send(self, to: str, subject: str, text: str) -> bool:
        mail = Email(to, subject, text)
        self.sent.append(mail)
        if self.settings.email != "resend" or not self.settings.resend_api_key:
            log.info("email to %s: %s\n%s", to, subject, text)
            return True
        r = await post_json(
            self.http,
            "https://api.resend.com/emails",
            {"from": self.settings.email_from, "to": [to], "subject": subject, "text": text},
            {"Authorization": f"Bearer {self.settings.resend_api_key}"},
        )
        if r.status >= 300:
            log.warning("Resend refused an email to %s: %s %s", to, r.status, r.body[:200])
            return False
        return True
