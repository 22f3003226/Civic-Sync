"""
Policy Explainer — Indian Legislation in Plain Language
Streamlit frontend: imports app modules directly (no HTTP backend required).
"""

import sys
import os
import json
from pathlib import Path

# Ensure project root is on sys.path
ROOT = str(Path(__file__).parent.parent)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import streamlit as st
from dotenv import load_dotenv

load_dotenv()

# ── Page config (must be first Streamlit call) ─────────────────────────────
st.set_page_config(
    page_title="Policy Explainer — Indian Laws",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Lazy-load heavy modules into session state ─────────────────────────────
@st.cache_resource(show_spinner="Loading bills & building search indexes…")
def load_resources():
    from app.pdf_parser import load_all_bills
    from app.retrieval import HybridRetriever

    bills = load_all_bills()
    retrievers = {}
    for key, data in bills.items():
        retrievers[key] = HybridRetriever(data["chunks"], bill_key=key)
    return bills, retrievers


# ── Disclaimer banner ──────────────────────────────────────────────────────
st.markdown(
    """
<div style="background:#1565c0;color:#ffffff !important;padding:12px 18px;
            border-radius:6px;margin-bottom:16px;font-size:14px;">
<strong>⚠️ Information Notice — Not Legal Advice</strong><br/>
This is an AI-generated summary. It is <strong>not legal advice</strong> and
does not substitute consultation with a qualified advocate.
Always verify against the official Gazette text.
</div>
""",
    unsafe_allow_html=True,
)

st.title("🏛️ Policy Explainer — Indian Laws in Plain Language")
st.caption("Understand Indian legislation in simple English & Hindi · Powered by Claude Sonnet 4.6")

# ── Load resources ─────────────────────────────────────────────────────────
try:
    BILLS, RETRIEVERS = load_resources()
except Exception as e:
    st.error(f"Failed to load bills: {e}")
    st.stop()

# ── Sidebar ────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Settings")

    BILL_OPTIONS = {
        "dpdp": "🔐 DPDP Act 2023 — Data Protection",
        "social_security": "💼 Code on Social Security 2020",
        "bns": "⚖️ Bharatiya Nyaya Sanhita 2023",
        "telecom": "📱 Telecommunications Act 2023",
    }
    selected_key = st.selectbox(
        "Select Bill",
        options=list(BILL_OPTIONS.keys()),
        format_func=lambda k: BILL_OPTIONS[k],
    )

    PERSONAS = [
        "General User",
        "Gig Worker",
        "Farmer",
        "Small Business Owner",
        "Student",
        "Tenant",
    ]
    selected_persona = st.selectbox("Who are you?", PERSONAS)

    language = st.radio("Language", ["English", "Hindi"])

    st.divider()
    st.caption(f"Bills loaded: {len(BILLS)}")
    if BILLS:
        bill_data = BILLS.get(selected_key, {})
        st.caption(f"Sections in this bill: {len(bill_data.get('chunks', []))}")

# ── Main search area ───────────────────────────────────────────────────────
query = st.text_input(
    "Ask a question about this law",
    placeholder="e.g. What is personal data? What rights do I have?",
    key="query_input",
)

col_btn, col_clear = st.columns([2, 1])
with col_btn:
    search_clicked = st.button("🔍 Get Explanation", type="primary", use_container_width=True)
with col_clear:
    if st.button("Clear", use_container_width=True):
        for k in ["last_result", "last_query", "last_bill"]:
            st.session_state.pop(k, None)
        st.rerun()

# ── Search & summarise ─────────────────────────────────────────────────────
def run_query(bill_key: str, query_text: str) -> dict:
    from app.llm_handler import summarize_with_citations, verify_with_haiku
    import textstat

    retriever = RETRIEVERS[bill_key]
    results = retriever.retrieve(query_text, top_k=3)
    if not results:
        raise ValueError("No relevant sections found for this query.")

    top = results[0]
    bill_name = BILLS[bill_key]["display_name"]

    sonnet_resp = summarize_with_citations(top["text"], top["section"], bill_name)
    summary_json = sonnet_resp["summary"]

    try:
        haiku_resp = verify_with_haiku(top["text"], summary_json)
    except Exception as e:
        haiku_resp = {
            "overall_faithfulness_score": None,
            "requires_human_review": True,
            "red_flags": [str(e)],
            "approval": False,
        }

    summary_text = " ".join([
        summary_json.get("tl_dr", ""),
        summary_json.get("purpose", ""),
        " ".join(p.get("provision", "") for p in summary_json.get("key_provisions", [])),
    ])
    grade = textstat.flesch_kincaid_grade(summary_text) if summary_text.strip() else 8.0
    summary_json["grade_level"] = round(grade, 1)

    return {
        "section": top["section"],
        "source_text": top["text"],
        "summary": summary_json,
        "faithfulness_score": haiku_resp.get("overall_faithfulness_score"),
        "requires_review": haiku_resp.get("requires_human_review", True),
        "red_flags": haiku_resp.get("red_flags", []),
        "sonnet_usage": sonnet_resp["usage"],
    }


if search_clicked and query.strip():
    with st.spinner("🔍 Retrieving relevant sections… 📝 Generating explanation… ✅ Verifying accuracy…"):
        try:
            result = run_query(selected_key, query.strip())
            st.session_state["last_result"] = result
            st.session_state["last_query"] = query.strip()
            st.session_state["last_bill"] = selected_key
        except Exception as e:
            st.error(f"❌ Error: {e}")
            st.session_state.pop("last_result", None)

elif search_clicked and not query.strip():
    st.warning("Please enter a question first.")

# ── Display results ────────────────────────────────────────────────────────
if "last_result" in st.session_state:
    result = st.session_state["last_result"]
    summary = result["summary"]

    st.divider()

    # Header row
    h_col1, h_col2, h_col3 = st.columns([3, 1, 1])
    with h_col1:
        st.subheader(f"📄 {result['section']}")
    with h_col2:
        grade = summary.get("grade_level", "—")
        st.metric("Reading Grade", f"{grade} / 18", help="Flesch-Kincaid grade level. 6–8 = easy to read. 18 = very complex legal text.")
    with h_col3:
        score = result.get("faithfulness_score")
        if score is not None:
            colour = "normal" if score >= 4.0 else "inverse"
            st.metric("AI Accuracy", f"{score:.1f}/5", delta_color=colour)
        else:
            st.metric("AI Accuracy", "N/A")

    if result.get("requires_review"):
        st.warning("⚠️ Faithfulness score below threshold — treat with extra caution.")

    # Split pane: summary left | source right
    left, right = st.columns([1, 1])

    with left:
        st.markdown("### Summary")

        # TL;DR
        tl_dr = summary.get("tl_dr", "")
        st.info(f"**TL;DR:** {tl_dr}")

        # Purpose
        purpose = summary.get("purpose", "")
        if purpose:
            st.markdown(f"**Purpose:** {purpose}")

        # Key provisions
        provisions = summary.get("key_provisions", [])
        if provisions:
            st.markdown("### Key Provisions")
            for prov in provisions:
                with st.expander(f"📌 {prov.get('provision', '')[:80]}…"):
                    st.markdown(f"**Rule:** {prov.get('provision', '')}")
                    st.markdown(f"**Source:** `{prov.get('source_section', '')}`")
                    eg = prov.get("concrete_example", "")
                    if eg:
                        st.markdown(f"**Example:** {eg}")

        # Persona impact
        impacts = summary.get("persona_impacts", [])
        persona_impacts = [
            i for i in impacts
            if i.get("persona", "").lower() in (selected_persona.lower(), "general user")
        ]
        if not persona_impacts:
            persona_impacts = impacts  # Show all if no match

        if persona_impacts:
            st.markdown(f"### For {selected_persona}")
            for imp in persona_impacts:
                persona = imp.get("persona", selected_persona)
                with st.expander(f"👤 {persona}"):
                    st.markdown(imp.get("concrete_impact", ""))
                    tl = imp.get("timeline")
                    if tl:
                        st.caption(f"⏱️ {tl}")
                    info = imp.get("no_recommendation_only_info")
                    if info:
                        st.caption(f"ℹ️ {info}")

        # Misconceptions
        misconceptions = summary.get("common_misconceptions", [])
        if misconceptions:
            with st.expander("🔍 Common Misconceptions"):
                for m in misconceptions:
                    st.markdown(f"- {m}")

        # Hindi toggle
        if language == "Hindi":
            st.markdown("---")
            st.markdown("### हिंदी अनुवाद")
            with st.spinner("Translating to Hindi via Bhashini…"):
                try:
                    from app.translator import translate_to_hindi
                    hindi_tldr = translate_to_hindi(tl_dr)
                    hindi_purpose = translate_to_hindi(purpose)
                    st.info(f"**सारांश:** {hindi_tldr}")
                    st.markdown(f"**उद्देश्य:** {hindi_purpose}")
                except Exception as e:
                    st.caption(f"Hindi translation unavailable: {e}")

    with right:
        st.markdown("### Source Text")
        st.caption(f"Bill: {BILLS[st.session_state['last_bill']]['display_name']}")

        source = result.get("source_text", "")
        st.text_area(
            label="Original bill text (read-only)",
            value=source[:3000],
            height=500,
            disabled=True,
            key="source_text_box",
        )

    # Ambiguities
    ambiguities = summary.get("ambiguities", [])
    if ambiguities:
        st.markdown("---")
        st.markdown("### 🟡 Parts of This Law That Are Unclear")
        st.caption("These clauses have more than one possible meaning. Even lawyers disagree on how to read them.")
        for i, amb in enumerate(ambiguities, 1):
            clause = amb.get("ambiguous_text", "Unclear clause")
            with st.expander(f"🟡 Unclear part {i}: {clause[:70]}…"):
                st.markdown("**What does this phrase mean?**")
                st.markdown(f"> _{clause}_")
                st.divider()
                st.markdown(f"🔵 **One way to read it:** {amb.get('interpretation_1', '')}")
                interp2 = amb.get("interpretation_2")
                if interp2:
                    st.markdown(f"🟠 **Another way to read it:** {interp2}")
                note = amb.get("expert_note", "")
                if note:
                    st.info(f"**Why lawyers debate this:** {note}")

    # Red flags from Haiku
    red_flags = result.get("red_flags", [])
    # Filter out raw Python error strings (e.g. JSON parse errors) and show them differently
    _parse_errors = [f for f in red_flags if "line 1 column" in f or "Expecting value" in f or "JSONDecodeError" in f]
    _real_flags = [f for f in red_flags if f not in _parse_errors]

    if _parse_errors:
        with st.expander("⚙️ AI Checker Could Not Run"):
            st.caption(
                "The accuracy checker (Claude Haiku) could not verify this summary. "
                "This usually happens when the response was too long or in an unexpected format. "
                "Treat the summary above with extra care and verify against the source text."
            )

    if _real_flags:
        with st.expander("🚩 Accuracy Warnings — Read These Carefully"):
            st.caption(
                "Our AI checker (Claude Haiku) compared the summary to the original bill "
                "and flagged these possible issues:"
            )
            for flag in _real_flags:
                st.markdown(f"⚠️ {flag}")

    # Token usage (collapsible)
    with st.expander("📊 How Much Did This Cost?"):
        usage = result.get("sonnet_usage", {})
        inp = usage.get("input_tokens", 0)
        out = usage.get("output_tokens", 0)
        # Approximate cost: Sonnet $3/M input, $15/M output
        cost_usd = (inp * 3 + out * 15) / 1_000_000
        st.markdown(f"**Words read by AI (input):** {inp:,} tokens")
        st.markdown(f"**Words written by AI (output):** {out:,} tokens")
        st.markdown(f"**Estimated cost of this query:** ${cost_usd:.4f} USD (~₹{cost_usd*84:.2f})")
        st.caption("Powered by Claude Sonnet 4.6 (summary) + Claude Haiku 4.5 (accuracy check)")

    # Persistent disclaimer at bottom
    st.divider()
    st.caption(
        "⚠️ **Disclaimer**: This AI-generated summary is for informational purposes only. "
        "It is NOT legal advice. Always consult a qualified lawyer before acting on any law. "
        "Source: India Code / Parliament of India · CC-BY 4.0"
    )

# ── Empty state ────────────────────────────────────────────────────────────
else:
    st.markdown("---")
    with st.container():
        st.markdown("### Try these questions:")
        demo_qs = {
            "dpdp": [
                "What is personal data?",
                "What is a data fiduciary?",
                "What are my rights under DPDP?",
            ],
            "social_security": [
                "What benefits do gig workers get?",
                "Who is covered under social security?",
            ],
            "bns": [
                "What is a cognizable offence?",
                "What are the punishments for theft?",
            ],
            "telecom": [
                "What is a licensed telecom entity?",
                "What is biometric KYC?",
            ],
        }
        for q in demo_qs.get(selected_key, []):
            if st.button(q, key=f"demo_{q}"):
                st.session_state["query_input"] = q
                st.rerun()

    st.markdown("---")
    st.markdown(
        "**Roadmap**: WhatsApp bot · All 22 scheduled languages · State laws · Bill comparison"
    )
