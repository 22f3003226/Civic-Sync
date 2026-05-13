import os
import io
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

from app.pdf_parser import (
    load_all_bills, BILL_DISPLAY_NAMES,
    extract_text_from_bytes, chunk_by_section,
)
from app.retrieval import HybridRetriever
from app.llm_handler import summarize_with_citations, verify_with_haiku
from app.schemas import BillResponse, SonnetSummary, HaikuJudgement
from app.rights_checker import check_rights
from app.conflict_detector import detect_conflicts
from app.verdict_agents import run_verdict_agents
from app.state_bills import filter_bills, get_states, get_year_range
from app.cost_tracker import tracker

import textstat

app = FastAPI(title="CivicSync", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BILLS: dict = {}
RETRIEVERS: dict = {}
UPLOADED_BILLS: dict = {}  # in-memory uploaded PDF registry

DISCLAIMER = (
    "AI-generated information only — NOT legal advice. "
    "Consult a qualified advocate before taking any action. "
    "Source: India Code / Parliament of India."
)


@app.on_event("startup")
async def startup():
    global BILLS, RETRIEVERS
    BILLS = load_all_bills()
    for key, data in BILLS.items():
        RETRIEVERS[key] = HybridRetriever(data["chunks"], bill_key=key)
        print(f"✅ Retriever ready for {key}")


# ── Health & metadata ───────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "bills_loaded": list(BILLS.keys()),
        "cost_summary": tracker.summary(),
    }


@app.get("/bills")
def list_bills():
    return {
        key: {
            "display_name": data["display_name"],
            "num_sections": len(data["chunks"]),
            "tag": data.get("tag", "Central"),
        }
        for key, data in BILLS.items()
    }


@app.get("/cost")
def cost_summary():
    return tracker.summary()


# ── Explain a Law ───────────────────────────────────────────────────────────

@app.post("/summarize")
async def summarize(
    bill: str = Query(..., description="Bill key"),
    query: str = Query(..., description="User question about the bill"),
    persona: Optional[str] = Query(None, description="User persona for filtered impacts"),
    top_k: int = Query(3, ge=1, le=10),
):
    all_bills = {**BILLS, **UPLOADED_BILLS}
    all_retrievers = {**RETRIEVERS}

    if bill not in all_retrievers:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown bill '{bill}'. Valid keys: {list(all_retrievers.keys())}",
        )

    retriever = all_retrievers[bill]
    results = retriever.retrieve(query, top_k=top_k)

    if not results:
        raise HTTPException(status_code=404, detail="No relevant sections found for this query.")

    top = results[0]
    bill_name = all_bills.get(bill, {}).get("display_name", bill.upper())

    try:
        sonnet_resp = summarize_with_citations(
            bill_text=top["text"],
            section_name=top["section"],
            bill_name=bill_name,
            custom_persona=persona or "",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sonnet summarization failed: {e}")

    summary_json = sonnet_resp["summary"]

    try:
        haiku_resp = verify_with_haiku(top["text"], summary_json)
    except Exception as e:
        haiku_resp = {
            "overall_faithfulness_score": None,
            "requires_human_review": True,
            "red_flags": [f"Haiku verification failed: {e}"],
            "approval": False,
        }

    summary_text = " ".join([
        summary_json.get("tl_dr", ""),
        summary_json.get("purpose", ""),
        " ".join(p.get("provision", "") for p in summary_json.get("key_provisions", [])),
    ])
    computed_grade = textstat.flesch_kincaid_grade(summary_text) if summary_text.strip() else 8.0
    summary_json["grade_level"] = round(computed_grade, 1)

    return BillResponse(
        bill=bill,
        bill_display_name=bill_name,
        section=top["section"],
        source_text=top["text"][:3000],
        summary=SonnetSummary(**summary_json),
        faithfulness_score=haiku_resp.get("overall_faithfulness_score") or 0.0,
        requires_review=haiku_resp.get("requires_human_review", True),
        red_flags=haiku_resp.get("red_flags", []),
        tokens_used={
            "sonnet": sonnet_resp["usage"],
            "haiku": haiku_resp.get("usage", {}),
        },
        generated_at=datetime.utcnow().isoformat(),
        disclaimer=DISCLAIMER,
    )


# ── Rights Checker ──────────────────────────────────────────────────────────

class RightsRequest(BaseModel):
    situation: str
    uploaded_bill_key: Optional[str] = None


@app.post("/rights")
async def rights(req: RightsRequest):
    uploaded = {}
    if req.uploaded_bill_key and req.uploaded_bill_key in UPLOADED_BILLS:
        uploaded = {req.uploaded_bill_key: UPLOADED_BILLS[req.uploaded_bill_key]}
    result = check_rights(req.situation, uploaded_bills=uploaded or None)
    return result


# ── Cross-Bill Conflict Detector ────────────────────────────────────────────

class ConflictRequest(BaseModel):
    bill_a: str
    bill_b: str
    topic: str = ""


@app.post("/conflicts")
async def conflicts(req: ConflictRequest):
    all_bills = {**BILLS, **UPLOADED_BILLS}
    if req.bill_a not in all_bills or req.bill_b not in all_bills:
        raise HTTPException(
            status_code=400,
            detail=f"One or both bill keys not found. Available: {list(all_bills.keys())}",
        )
    result = detect_conflicts(req.bill_a, req.bill_b, req.topic, uploaded_bills=UPLOADED_BILLS or None)
    return result


# ── 5-Perspective Verdict Panel ─────────────────────────────────────────────

class VerdictRequest(BaseModel):
    summary: dict
    bill_name: str


@app.post("/verdict")
async def verdict(req: VerdictRequest):
    results = list(run_verdict_agents(req.summary, req.bill_name))
    pos = sum(1 for r in results if r.get("verdict") in {"positive", "protective", "robust", "business_friendly", "good_news"})
    concern = sum(1 for r in results if r.get("verdict") in {"concern", "exclusionary", "legally_risky", "burdensome", "bad_news"})
    return {
        "verdicts": results,
        "total": len(results),
        "summary": {"positive": pos, "concern": concern, "mixed": len(results) - pos - concern},
    }


# ── Browse State Bills ──────────────────────────────────────────────────────

@app.get("/state-bills")
async def state_bills_list(
    state: Optional[str] = Query(None),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    query: str = Query(""),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
):
    rows = filter_bills(state=state, year_from=year_from, year_to=year_to, query=query)
    yr = get_year_range()
    return {
        "total": len(rows),
        "bills": rows[offset: offset + limit],
        "states": get_states(),
        "year_range": {"min": yr[0], "max": yr[1]},
    }


# ── PDF Upload ──────────────────────────────────────────────────────────────

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()

    try:
        text = extract_text_from_bytes(pdf_bytes, max_pages=100)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract text from PDF. Is this a scanned image? Error: {e}",
        )

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="PDF appears to be image-scanned; no text layer found. Please use a text-layer PDF.",
        )

    safe_name = "".join(c if c.isalnum() else "_" for c in file.filename[:30])
    key = f"upload_{len(UPLOADED_BILLS)}_{safe_name}"
    display_name = file.filename.replace(".pdf", "").replace("_", " ").replace("-", " ")[:80]
    chunks = chunk_by_section(text, key)

    UPLOADED_BILLS[key] = {
        "display_name": display_name,
        "chunks": chunks,
        "text": text[:50_000],
        "path": f"[uploaded] {file.filename}",
        "tag": "Uploaded",
    }

    BILLS[key] = UPLOADED_BILLS[key]
    RETRIEVERS[key] = HybridRetriever(chunks, bill_key=key)

    return {
        "key": key,
        "display_name": display_name,
        "num_sections": len(chunks),
        "message": "PDF uploaded and indexed successfully.",
    }


_DIST = "frontend-react/dist"
if os.path.exists(_DIST):
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=7860, reload=True)
