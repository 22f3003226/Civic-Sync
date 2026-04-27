import re
import pdfplumber
from typing import List, Dict


BILL_PATHS: Dict[str, str] = {
    "dpdp": "bills/Digital Personal Data Protection Act 2023.pdf",
    "social_security": "bills/Code on Social Security 2020.pdf",
    "bns": "bills/Bharatiya Nyaya Sanhita 2023.pdf",
    "telecom": "bills/Telecommunications Act 2023.pdf",
}

BILL_DISPLAY_NAMES: Dict[str, str] = {
    "dpdp": "Digital Personal Data Protection Act 2023",
    "social_security": "Code on Social Security 2020",
    "bns": "Bharatiya Nyaya Sanhita 2023",
    "telecom": "Telecommunications Act 2023",
}


def extract_bill_text(pdf_path: str) -> str:
    """Extract full text from a bill PDF using pdfplumber."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n".join(pages)


def chunk_by_section(raw_text: str, bill_key: str = "") -> List[Dict]:
    """
    Split bill text into Section-level chunks.
    Keeps subsections and provisos with their parent section.
    Returns list of {section, text, has_provisos, token_count} dicts.
    """
    # Find all section start positions using a forgiving pattern
    # Matches "1. Short title..." or "Section 1." style headings
    section_pattern = re.compile(
        r'(?:^|\n)(\d{1,3})\.\s+([A-Z][^\n]{2,})',
        re.MULTILINE
    )

    matches = list(section_pattern.finditer(raw_text))

    if not matches:
        # Fallback: return entire text as one chunk
        return [{
            "section": "Full Text",
            "text": raw_text[:8000],
            "has_provisos": False,
            "token_count": len(raw_text.split()),
        }]

    sections = []
    for i, match in enumerate(matches):
        section_num = match.group(1)
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw_text)
        section_text = raw_text[start:end].strip()

        # Skip very short chunks (likely headers)
        if len(section_text.split()) < 10:
            continue

        has_provisos = bool(
            re.search(r'[Pp]rovided that', section_text)
            or re.search(r'[Ss]ubject to', section_text)
        )

        sections.append({
            "section": f"Section {section_num}",
            "text": section_text,
            "has_provisos": has_provisos,
            "token_count": len(section_text.split()),
        })

    return sections


def load_all_bills() -> Dict[str, Dict]:
    """Load and chunk all bills. Returns {bill_key: {text, chunks, display_name}}."""
    bills = {}
    for key, path in BILL_PATHS.items():
        try:
            text = extract_bill_text(path)
            chunks = chunk_by_section(text, key)
            bills[key] = {
                "text": text,
                "chunks": chunks,
                "path": path,
                "display_name": BILL_DISPLAY_NAMES[key],
            }
            print(f"✅ Loaded {key}: {len(chunks)} sections")
        except Exception as e:
            print(f"❌ Failed to load {key}: {e}")
    return bills


if __name__ == "__main__":
    bills = load_all_bills()
    for k, v in bills.items():
        print(f"{k}: {len(v['chunks'])} sections")
        if v["chunks"]:
            s = v["chunks"][0]
            print(f"  First section: {s['section']} ({s['token_count']} tokens)")
