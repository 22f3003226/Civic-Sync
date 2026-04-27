"""
State Bills browser — loads data/bills_states.csv and exposes filter helpers.
"""
import csv
import re
import os
import urllib.parse
from typing import List, Dict, Optional
from functools import lru_cache

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "bills_states.csv")


def _parse_year(date_str: str) -> Optional[int]:
    """Convert 'Apr-61' / 'Dec-99' / 'Jan-05' → full 4-digit year."""
    m = re.search(r"-(\d{2})$", date_str.strip())
    if not m:
        return None
    yy = int(m.group(1))
    # yy >= 61 → 1961-1999; yy < 61 → 2000-2060
    return 1900 + yy if yy >= 61 else 2000 + yy


@lru_cache(maxsize=1)
def load_state_bills() -> List[Dict]:
    """Return all rows from bills_states.csv with a parsed `year` int field."""
    rows = []
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get("state", "").strip():
                continue
            row = dict(row)
            row["year"] = _parse_year(row.get("date", ""))
            rows.append(row)
    return rows


def get_states() -> List[str]:
    return sorted(set(r["state"] for r in load_state_bills() if r["state"]))


def get_year_range() -> tuple:
    years = [r["year"] for r in load_state_bills() if r["year"]]
    return (min(years), max(years)) if years else (1960, 2025)


def prs_search_url(bill_name: str, state: str = "") -> str:
    """
    Construct a Google search URL scoped to prsindia.org for a state bill.
    PRS India doesn't have per-bill summary pages for the 23k CSV entries,
    so a scoped Google search is the most reliable way to surface any
    PRS content that does exist for a given bill.
    """
    query = f'site:prsindia.org "{bill_name}"'
    return f"https://www.google.com/search?q={urllib.parse.quote(query)}"


def filter_bills(
    state: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    query: str = "",
) -> List[Dict]:
    rows = load_state_bills()
    if state and state != "All States":
        rows = [r for r in rows if r["state"] == state]
    if year_from:
        rows = [r for r in rows if r["year"] and r["year"] >= year_from]
    if year_to:
        rows = [r for r in rows if r["year"] and r["year"] <= year_to]
    if query.strip():
        q = query.strip().lower()
        rows = [r for r in rows if q in r["bill"].lower()]
    return rows
