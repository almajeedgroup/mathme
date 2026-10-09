"""GST for Indian invoices. MathMe prices are shown before GST; 18% is added at checkout.

Within the seller's own state the tax is split into CGST + SGST (9% + 9%); for a buyer in another
state it is one IGST line (18%). Amounts are whole paise; the tax is rounded half up to the paisa.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

RATE_PERCENT = 18

# States and union territories (GST state names), for the billing form and the tax split.
STATES = [
    "Andaman and Nicobar Islands",
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chandigarh",
    "Chhattisgarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Ladakh",
    "Lakshadweep",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
]


@dataclass(frozen=True)
class Tax:
    base: int
    cgst: int
    sgst: int
    igst: int
    total: int

    def dict(self) -> dict[str, int]:
        return asdict(self)


def add_gst(base: int, seller_state: str, buyer_state: str) -> Tax:
    """Base price (paise, before GST) → the tax lines and the total to charge."""
    tax = (base * RATE_PERCENT + 50) // 100  # 18%, rounded half up to the paisa
    if seller_state.strip().lower() == buyer_state.strip().lower():
        cgst = tax // 2
        return Tax(base, cgst, tax - cgst, 0, base + tax)
    return Tax(base, 0, 0, tax, base + tax)


def rupees(paise: int) -> str:
    """12345 → '123.45' (for payment APIs that take rupees)."""
    return f"{paise // 100}.{paise % 100:02d}"


def financial_year(ts: int) -> str:
    """Indian financial year (April to March) for an invoice number, e.g. '2026-27'."""
    import datetime as dt

    d = dt.datetime.fromtimestamp(ts, dt.UTC)
    start = d.year if d.month >= 4 else d.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


def valid_gstin(gstin: str) -> bool:
    """Shape check for a 15-character GSTIN (2-digit state code, PAN, entity, Z, check character)."""
    import re

    return bool(re.fullmatch(r"\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]", gstin.strip().upper()))
