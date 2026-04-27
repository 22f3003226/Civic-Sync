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


@st.cache_data(show_spinner=False)
def load_state_bills_data():
    from app.state_bills import load_state_bills, get_states, get_year_range
    rows = load_state_bills()
    states = get_states()
    year_range = get_year_range()
    return rows, states, year_range


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

# ── Sidebar (shared across tabs) ───────────────────────────────────────────
with st.sidebar:
    st.header("Settings")

    BILL_OPTIONS = {
        "dpdp": "🔐 DPDP Act 2023 — Data Protection",
        "social_security": "💼 Code on Social Security 2020",
        "bns": "⚖️ Bharatiya Nyaya Sanhita 2023",
        "telecom": "📱 Telecommunications Act 2023",
        "maha_rent": "🏠 Maharashtra Rent Control Act 1999 ⭐",
    }
    selected_key = st.selectbox(
        "Select Bill (Explain tab)",
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
        "🎯 Other (Custom)",
    ]
    selected_persona = st.selectbox("Who are you?", PERSONAS)

    custom_persona = ""
    if selected_persona == "🎯 Other (Custom)":
        st.markdown("**Describe yourself so Claude can personalise the explanation:**")
        custom_persona = st.text_area(
            label="Your persona",
            value="I am a 28-year-old salaried employee in Bengaluru. "
                  "I work in IT and earn ₹8 lakh per year. "
                  "I use apps like Swiggy, Zepto, and Razorpay daily.",
            height=100,
            help="The more specific you are, the more personalised the explanation will be.",
            key="custom_persona_input",
        )
        if not custom_persona.strip():
            st.warning("Please describe yourself to get a personalised explanation.")

    language = st.radio("Language", ["English", "Hindi"])

    st.divider()
    st.caption(f"Bills loaded: {len(BILLS)}")
    if BILLS:
        bill_data = BILLS.get(selected_key, {})
        st.caption(f"Sections in this bill: {len(bill_data.get('chunks', []))}")

# ── Tabs ───────────────────────────────────────────────────────────────────
tab_explain, tab_browse = st.tabs(["📜 Explain a Law", "📊 Browse State Bills"])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: Explain a Law
# ══════════════════════════════════════════════════════════════════════════════
with tab_explain:
    # ── Main search area ───────────────────────────────────────────────────
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

    # ── Search & summarise ─────────────────────────────────────────────────
    def run_query(bill_key: str, query_text: str, custom_persona: str = "") -> dict:
        from app.llm_handler import summarize_with_citations, verify_with_haiku
        import textstat

        retriever = RETRIEVERS[bill_key]
        results = retriever.retrieve(query_text, top_k=3)
        if not results:
            raise ValueError("No relevant sections found for this query.")

        top = results[0]
        bill_name = BILLS[bill_key]["display_name"]

        sonnet_resp = summarize_with_citations(top["text"], top["section"], bill_name, custom_persona=custom_persona)
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
                result = run_query(selected_key, query.strip(), custom_persona=custom_persona)
                st.session_state["last_result"] = result
                st.session_state["last_query"] = query.strip()
                st.session_state["last_bill"] = selected_key
            except Exception as e:
                st.error(f"❌ Error: {e}")
                st.session_state.pop("last_result", None)

    elif search_clicked and not query.strip():
        st.warning("Please enter a question first.")

    # ── Display results ────────────────────────────────────────────────────
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

            tl_dr = summary.get("tl_dr", "")
            st.info(f"**TL;DR:** {tl_dr}")

            purpose = summary.get("purpose", "")
            if purpose:
                st.markdown(f"**Purpose:** {purpose}")

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

            impacts = summary.get("persona_impacts", [])
            persona_impacts = [
                i for i in impacts
                if i.get("persona", "").lower() in (selected_persona.lower(), "general user")
            ]
            if not persona_impacts:
                persona_impacts = impacts

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

            misconceptions = summary.get("common_misconceptions", [])
            if misconceptions:
                with st.expander("🔍 Common Misconceptions"):
                    for m in misconceptions:
                        st.markdown(f"- {m}")

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
        _JSON_ERROR_HINTS = ("line ", "column ", "char ", "Expecting", "JSONDecodeError", "json", "delimiter", "Unterminated", "truncated")
        _parse_errors = [f for f in red_flags if any(hint.lower() in f.lower() for hint in _JSON_ERROR_HINTS)]
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

        # ── Policy Verdict Panel ───────────────────────────────────────────
        st.markdown("---")
        st.markdown("### 🔍 Policy Verdict — 5 Perspectives")
        st.caption(
            "Five AI analysts — economist, social worker, legal expert, industry advisor, and "
            "ordinary citizen — each read the same summary and give their independent verdict. "
            "Each uses ~550 input tokens (Haiku), run sequentially to stay within rate limits."
        )

        verdict_btn_col, verdict_clear_col = st.columns([2, 1])
        with verdict_btn_col:
            run_verdict = st.button(
                "🔍 Run 5-Perspective Analysis",
                key="run_verdict_btn",
                type="secondary",
                use_container_width=True,
            )
        with verdict_clear_col:
            if st.button("Clear Verdicts", key="clear_verdict_btn", use_container_width=True):
                st.session_state.pop("verdict_results", None)
                st.rerun()

        if run_verdict:
            from app.verdict_agents import run_verdict_agents
            bill_name = BILLS[st.session_state["last_bill"]]["display_name"]
            verdicts = []
            progress = st.progress(0, text="Starting analysis…")
            agent_labels = ["💰 Economist", "👷 Social Worker", "⚖️ Legal Expert", "🏢 Industry", "👤 Citizen"]
            for i, agent_result in enumerate(run_verdict_agents(summary, bill_name)):
                verdicts.append(agent_result)
                pct = (i + 1) / 5
                label = agent_labels[i] if i < len(agent_labels) else "…"
                progress.progress(pct, text=f"✅ {label} done ({i+1}/5)")
            progress.empty()
            st.session_state["verdict_results"] = verdicts
            st.rerun()

        if "verdict_results" in st.session_state:
            from app.verdict_agents import verdict_style
            verdicts = st.session_state["verdict_results"]

            # Verdict summary bar
            verdict_counts = {"positive": 0, "mixed_neutral": 0, "negative": 0}
            POSITIVE_VERDICTS = {"positive", "protective", "robust", "business_friendly", "good_news"}
            NEGATIVE_VERDICTS = {"concern", "exclusionary", "legally_risky", "burdensome", "bad_news"}
            for v in verdicts:
                vd = v.get("verdict", "")
                if vd in POSITIVE_VERDICTS:
                    verdict_counts["positive"] += 1
                elif vd in NEGATIVE_VERDICTS:
                    verdict_counts["negative"] += 1
                else:
                    verdict_counts["mixed_neutral"] += 1

            pos, mix, neg = verdict_counts["positive"], verdict_counts["mixed_neutral"], verdict_counts["negative"]
            st.markdown(
                f"""
<div style="background:#1e293b;color:#f1f5f9;padding:14px 18px;border-radius:8px;
            display:flex;gap:24px;align-items:center;margin-bottom:12px;">
  <span style="font-size:1.1rem;font-weight:600;">Overall:</span>
  <span style="color:#4ade80;">✅ {pos} Positive</span>
  <span style="color:#facc15;">⚠️ {mix} Mixed</span>
  <span style="color:#f87171;">🔴 {neg} Concern</span>
</div>
""",
                unsafe_allow_html=True,
            )

            # Individual agent cards
            for v in verdicts:
                vd = v.get("verdict", "neutral")
                bg, fg, icon = verdict_style(vd)
                label = v.get("agent_label", "Agent")
                desc = v.get("agent_description", "")
                headline = v.get("headline", "")

                with st.expander(f"{icon} {label} — {headline}", expanded=False):
                    # Render all fields except internals
                    skip = {"agent_id", "agent_label", "agent_description", "verdict",
                            "headline", "_usage", "error", "confidence"}
                    field_labels = {
                        "positives": "✅ Positives",
                        "concerns": "⚠️ Concerns",
                        "who_is_protected": "🛡️ Who is protected",
                        "who_is_excluded": "❌ Who may be excluded",
                        "implementation_gap": "🔧 Implementation gap",
                        "grassroots_note": "🌱 Ground-level note",
                        "strengths": "✅ Legal strengths",
                        "gaps": "⚠️ Legal gaps",
                        "likely_litigation": "⚖️ Likely court challenge",
                        "constitutional_note": "📜 Constitutional angle",
                        "compliance_cost": "💸 Compliance cost",
                        "who_benefits": "✅ Who benefits",
                        "who_struggles": "⚠️ Who struggles",
                        "ease_of_doing_business": "🏢 Ease of doing business",
                        "msme_note": "🏪 MSME note",
                        "what_changes_for_me": "🔄 What changes",
                        "what_stays_same": "➖ What stays the same",
                        "biggest_question": "❓ Biggest question",
                        "trust_level": "🤝 Trust level",
                        "most_affected_sector": "🏭 Most affected sector",
                        "fiscal_note": "💰 Fiscal note",
                    }
                    for key, friendly in field_labels.items():
                        val = v.get(key)
                        if val:
                            if isinstance(val, list):
                                st.markdown(f"**{friendly}**")
                                for item in val:
                                    st.markdown(f"- {item}")
                            else:
                                st.markdown(f"**{friendly}:** {val}")

                    conf = v.get("confidence")
                    if conf is not None:
                        st.progress(float(conf), text=f"Confidence: {conf:.0%}")

                    if v.get("error"):
                        st.error(f"Error: {v['error']}")

        with st.expander("📊 How Much Did This Cost?"):
            usage = result.get("sonnet_usage", {})
            inp = usage.get("input_tokens", 0)
            out = usage.get("output_tokens", 0)
            cost_usd = (inp * 3 + out * 15) / 1_000_000
            st.markdown(f"**Words read by AI (input):** {inp:,} tokens")
            st.markdown(f"**Words written by AI (output):** {out:,} tokens")
            st.markdown(f"**Estimated cost of this query:** ${cost_usd:.4f} USD (~₹{cost_usd*84:.2f})")
            st.caption("Powered by Claude Sonnet 4.6 (summary) + Claude Haiku 4.5 (accuracy check + verdict agents)")

        st.divider()
        st.caption(
            "⚠️ **Disclaimer**: This AI-generated summary is for informational purposes only. "
            "It is NOT legal advice. Always consult a qualified lawyer before acting on any law. "
            "Source: India Code / Parliament of India · CC-BY 4.0"
        )

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
                "maha_rent": [
                    "Can my landlord evict me?",
                    "How much deposit can my landlord ask for?",
                    "What are my rights as a tenant?",
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


# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: Browse State Bills
# ══════════════════════════════════════════════════════════════════════════════
with tab_browse:
    try:
        all_rows, all_states, (yr_min, yr_max) = load_state_bills_data()
    except Exception as e:
        st.error(f"Could not load state bills data: {e}")
        st.stop()

    # ── Hero stat ──────────────────────────────────────────────────────────
    st.markdown(
        f"""
<div style="background:linear-gradient(135deg,#1565c0,#283593);color:#fff;
            padding:20px 24px;border-radius:10px;margin-bottom:20px;">
  <h2 style="margin:0;font-size:2rem;">📚 {len(all_rows):,} State Bills</h2>
  <p style="margin:4px 0 0;opacity:.85;">
    Across <strong>30 states & UTs</strong> · from <strong>{yr_min}</strong> to <strong>{yr_max}</strong>
    &nbsp;|&nbsp; Source: PRS Legislative Research
  </p>
</div>
""",
        unsafe_allow_html=True,
    )

    # ── Filters ────────────────────────────────────────────────────────────
    f_col1, f_col2, f_col3, f_col4 = st.columns([2, 1, 1, 2])

    with f_col1:
        state_filter = st.selectbox(
            "Filter by State",
            options=["All States"] + all_states,
            key="sb_state",
        )
    with f_col2:
        year_from = st.number_input("From year", min_value=yr_min, max_value=yr_max, value=yr_min, step=1, key="sb_yr_from")
    with f_col3:
        year_to = st.number_input("To year", min_value=yr_min, max_value=yr_max, value=yr_max, step=1, key="sb_yr_to")
    with f_col4:
        keyword = st.text_input("Search bill name", placeholder="e.g. rent, labour, education", key="sb_kw")

    # ── Apply filters ──────────────────────────────────────────────────────
    from app.state_bills import filter_bills
    filtered = filter_bills(
        state=state_filter if state_filter != "All States" else None,
        year_from=int(year_from),
        year_to=int(year_to),
        query=keyword,
    )

    st.caption(f"Showing **{len(filtered):,}** bills matching your filters")

    # ── Data table ─────────────────────────────────────────────────────────
    import pandas as pd

    if filtered:
        df = pd.DataFrame(filtered)[["bill", "state", "date", "chamber"]]
        df.columns = ["Bill Name", "State", "Date", "Legislature"]
        st.dataframe(
            df.head(500),
            use_container_width=True,
            height=420,
            hide_index=True,
        )
        if len(filtered) > 500:
            st.caption(f"Showing first 500 of {len(filtered):,} results. Narrow your filters to see more.")

        # Download button
        csv_bytes = df.to_csv(index=False).encode()
        st.download_button(
            label="⬇️ Download filtered list as CSV",
            data=csv_bytes,
            file_name="state_bills_filtered.csv",
            mime="text/csv",
        )
    else:
        st.info("No bills match your filters. Try widening the year range or clearing the keyword.")

    # ── State distribution chart ───────────────────────────────────────────
    st.markdown("---")
    st.markdown("### Bills by State")
    state_counts = {}
    for r in filtered:
        s = r["state"]
        state_counts[s] = state_counts.get(s, 0) + 1

    if state_counts:
        chart_df = (
            pd.DataFrame(list(state_counts.items()), columns=["State", "Bills"])
            .sort_values("Bills", ascending=False)
            .head(15)
        )
        st.bar_chart(chart_df.set_index("State"))

    # ── Surprise spotlight ─────────────────────────────────────────────────
    st.markdown("---")
    st.markdown(
        """
### ⭐ Spotlight: Maharashtra Rent Control Act 1999

> **Why this matters:** Over **12 million** households in Maharashtra rent their homes.
> This Act governs how much your landlord can charge, when they can evict you,
> and what rights you have as a tenant — yet most tenants have never read it.

Select **"🏠 Maharashtra Rent Control Act 1999 ⭐"** from the sidebar, then switch to the
**📜 Explain a Law** tab and ask a question like:

- *"Can my landlord evict me?"*
- *"How much deposit can my landlord ask for?"*
- *"What repairs must my landlord do?"*

Claude will explain it in plain language — no legal jargon.
"""
    )

    col_goto, _ = st.columns([1, 3])
    with col_goto:
        if st.button("🏠 Go to Explain tab →", type="primary"):
            st.session_state["_switch_tab"] = True
            st.rerun()
