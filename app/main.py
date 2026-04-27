import os
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.pdf_parser import load_all_bills, BILL_DISPLAY_NAMES
from app.retrieval import HybridRetriever
from app.llm_handler import summarize_with_citations, verify_with_haiku
from app.schemas import BillResponse, SonnetSummary, HaikuJudgement
from app.cost_tracker import tracker

import textstat

app = FastAPI(title="Policy Explainer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BILLS: dict = {}
RETRIEVERS: dict = {}

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


@app.get("/health")
def health():
    return {
        "status": "ok",
        "bills_loaded": list(BILLS.keys()),
        "cost_summary": tracker.summary(),
    }


@app.post("/summarize")
async def summarize(
    bill: str = Query(..., description="Bill key: dpdp | social_security | bns | telecom"),
    query: str = Query(..., description="User question about the bill"),
    persona: Optional[str] = Query(None, description="User persona for filtered impacts"),
    top_k: int = Query(3, ge=1, le=10),
):
    if bill not in RETRIEVERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown bill '{bill}'. Valid keys: {list(RETRIEVERS.keys())}",
        )

    retriever = RETRIEVERS[bill]
    results = retriever.retrieve(query, top_k=top_k)

    if not results:
        raise HTTPException(status_code=404, detail="No relevant sections found for this query.")

    top = results[0]
    bill_name = BILL_DISPLAY_NAMES.get(bill, bill.upper())

    try:
        sonnet_resp = summarize_with_citations(
            bill_text=top["text"],
            section_name=top["section"],
            bill_name=bill_name,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sonnet summarization failed: {e}")

    summary_json = sonnet_resp["summary"]

    try:
        haiku_resp = verify_with_haiku(top["text"], summary_json)
    except Exception as e:
        # Non-fatal: return summary without verification
        haiku_resp = {
            "overall_faithfulness_score": None,
            "requires_human_review": True,
            "red_flags": [f"Haiku verification failed: {e}"],
            "approval": False,
        }

    # Compute actual grade level on the summary text
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
        source_text=top["text"][:3000],  # Limit for UI rendering
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


@app.get("/bills")
def list_bills():
    return {
        key: {
            "display_name": data["display_name"],
            "num_sections": len(data["chunks"]),
        }
        for key, data in BILLS.items()
    }


@app.get("/cost")
def cost_summary():
    return tracker.summary()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
