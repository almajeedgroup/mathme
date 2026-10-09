import json
from pathlib import Path

import pytest

from account_service import plans
from account_service.core import add_months
from account_service.gst import add_gst, financial_year, rupees, valid_gstin

ROOT = Path(__file__).resolve().parents[2]


def test_the_packaged_plans_match_the_shared_file():
    shared = json.loads((ROOT / "shared" / "plans.json").read_text())
    assert plans.catalogue() == shared, "copy shared/plans.json into account-service/src/account_service/"


def test_launch_prices_before_gst():
    assert plans.price("plus", "monthly") == 29_900
    assert plans.price("plus", "annual") == 249_900
    assert plans.price("pro", "monthly") == 79_900
    assert plans.price("pro", "annual") == 699_900
    assert plans.price("campus", "annual") == 1_499_900
    with pytest.raises(KeyError):
        plans.price("free", "monthly")


@pytest.mark.parametrize(
    ("base", "total"),
    [(29_900, 35_282), (249_900, 294_882), (79_900, 94_282), (699_900, 825_882), (1_499_900, 1_769_882)],
)
def test_gst_is_added_on_top(base, total):
    assert add_gst(base, "Karnataka", "Kerala").total == total


def test_same_state_splits_cgst_and_sgst():
    same = add_gst(29_900, "Karnataka", "karnataka")
    assert (same.cgst, same.sgst, same.igst) == (2691, 2691, 0)
    other = add_gst(29_900, "Karnataka", "Maharashtra")
    assert (other.cgst, other.sgst, other.igst) == (0, 0, 5382)
    odd = add_gst(1, "Goa", "Goa")  # tax rounds to 0 paise
    assert odd.total == 1
    assert rupees(35_282) == "352.82"


def test_financial_year_and_gstin():
    assert financial_year(1_791_590_400) == "2026-27"  # October 2026
    assert financial_year(1_769_904_000) == "2025-26"  # February 2026
    assert valid_gstin("29ABCDE1234F1Z5")
    assert not valid_gstin("29ABCDE1234F1X5")
    assert not valid_gstin("hello")


def test_add_months_keeps_the_day_or_the_month_end():
    jan31 = 1_769_817_600  # 2026-01-31
    assert add_months(jan31, 1) == 1_772_236_800  # 2026-02-28
    assert add_months(jan31, 12) == 1_801_353_600  # 2027-01-31
