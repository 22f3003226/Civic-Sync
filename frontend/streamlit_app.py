"""
Policy Explainer — Indian Legislation in Plain Language
Streamlit frontend with shadcn-inspired design and security guardrails.
"""

import sys
import os
import json
from pathlib import Path

ROOT = str(Path(__file__).parent.parent)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import streamlit as st
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(
    page_title="Policy Explainer — Indian Laws",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Inject shadcn CSS ───────────────────────────────────────────────────────
from frontend.theme import SHADCN_CSS, notice_html, badge_html, verdict_card_html
st.markdown(SHADCN_CSS, unsafe_allow_html=True)


# ── Resource loaders ────────────────────────────────────────────────────────
@st.cache_resource(show_spinner="Loading bills & building search indexes…")
def load_resources():
    from app.pdf_parser import load_all_bills
    from app.retrieval import HybridRetriever
    bills = load_all_bills()
    retrievers = {k: HybridRetriever(d["chunks"], bill_key=k) for k, d in bills.items()}
    return bills, retrievers


@st.cache_data(show_spinner=False)
def load_state_bills_data():
    from app.state_bills import load_state_bills, get_states, get_year_range
    return load_state_bills(), get_states(), get_year_range()


# ── Header ──────────────────────────────────────────────────────────────────
st.markdown(
    """
<div style="border-bottom:1px solid #e4e4e7;padding-bottom:1rem;margin-bottom:1.25rem;">
  <div style="display:flex;align-items:center;gap:0.75rem;">
    <span style="font-size:1.75rem;">🏛️</span>
    <div>
      <h1 style="margin:0;font-size:1.375rem;font-weight:700;
                 letter-spacing:-0.02em;color:#09090b;">
        Policy Explainer
      </h1>
      <p style="margin:0;font-size:0.8125rem;color:#71717a;">
        Indian legislation in plain language · Powered by Claude Sonnet 4.6 + Haiku 4.5
      </p>
    </div>
  </div>
</div>
""",
    unsafe_allow_html=True,
)

# ── Legal notice banner ─────────────────────────────────────────────────────
st.markdown(
    notice_html(
        "<strong>Information notice — not legal advice.</strong> "
        "AI-generated summaries do not substitute consultation with a qualified advocate. "
        "Always verify against the official Gazette text.",
        kind="warning",
    ),
    unsafe_allow_html=True,
)

# ── Load resources ──────────────────────────────────────────────────────────
try:
    BILLS, RETRIEVERS = load_resources()
except Exception as e:
    st.error(f"Failed to load bills: {e}")
    st.stop()

# ── Sidebar ─────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        '<p style="font-size:0.75rem;font-weight:600;color:#71717a;'
        'text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">'
        'SETTINGS</p>',
        unsafe_allow_html=True,
    )

    BILL_OPTIONS = {
        "dpdp":           "DPDP Act 2023 — Data Protection",
        "social_security": "Code on Social Security 2020",
        "bns":            "Bharatiya Nyaya Sanhita 2023",
        "telecom":        "Telecommunications Act 2023",
        "maha_rent":      "Maharashtra Rent Control Act 1999 ★",
    }
    selected_key = st.selectbox(
        "Bill",
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
        "Other (Custom)",
    ]
    selected_persona = st.selectbox("Who are you?", PERSONAS)

    custom_persona = ""
    if selected_persona == "Other (Custom)":
        st.markdown(
            '<p style="font-size:0.8125rem;color:#71717a;margin:0.25rem 0;">'
            'Describe yourself for a personalised explanation:</p>',
            unsafe_allow_html=True,
        )
        custom_persona = st.text_area(
            label="Your background",
            value="I am a 28-year-old salaried IT employee in Bengaluru, "
                  "earning ₹8 lakh per year. I use Swiggy, Zepto, and Razorpay daily.",
            height=100,
            key="custom_persona_input",
            label_visibility="collapsed",
        )
        if not custom_persona.strip():
            st.warning("Please describe yourself to get a personalised explanation.")

    language = st.radio("Language", ["English", "Hindi"])

    st.divider()

    # Stats
    bill_data = BILLS.get(selected_key, {})
    tag = bill_data.get("tag", "Central")
    st.markdown(
        f'<div style="display:flex;flex-direction:column;gap:0.25rem;">'
        f'<span style="font-size:0.75rem;color:#71717a;">Bills loaded: <strong>{len(BILLS)}</strong></span>'
        f'<span style="font-size:0.75rem;color:#71717a;">Sections: <strong>{len(bill_data.get("chunks", []))}</strong></span>'
        f'<span style="font-size:0.75rem;color:#71717a;">Type: <strong>{tag}</strong></span>'
        f'</div>',
        unsafe_allow_html=True,
    )

# ── Tabs ─────────────────────────────────────────────────────────────────────
tab_explain, tab_browse = st.tabs(["Explain a Law", "Browse State Bills"])


# ════════════════════════════════════════════════════════════════════════════
# TAB 1 — Explain a Law
# ════════════════════════════════════════════════════════════════════════════
with tab_explain:

    # ── Query box ─────────────────────────────────────────────────────────
    query = st.text_input(
        "Your question",
        placeholder="e.g. What is personal data?  What rights do I have?",
        key="query_input",
        label_visibility="collapsed",
    )

    btn_col, clr_col = st.columns([3, 1])
    with btn_col:
        search_clicked = st.button(
            "Get Explanation", type="primary", use_container_width=True
        )
    with clr_col:
        if st.button("Clear", use_container_width=True):
            for k in ["last_result", "last_query", "last_bill", "verdict_results"]:
                st.session_state.pop(k, None)
            st.rerun()

    # ── Security: sanitize input ──────────────────────────────────────────
    def run_query(bill_key: str, query_text: str, persona: str = "") -> dict:
        from app.llm_handler import summarize_with_citations, verify_with_haiku
        from app.sanitizer import sanitize_persona, check_output_prescriptive
        import textstat

        persona = sanitize_persona(persona)
        retriever = RETRIEVERS[bill_key]
        results = retriever.retrieve(query_text, top_k=3)
        if not results:
            raise ValueError("No relevant sections found.")

        top = results[0]
        bill_name = BILLS[bill_key]["display_name"]
        sonnet = summarize_with_citations(
            top["text"], top["section"], bill_name, custom_persona=persona
        )
        summary_json = sonnet["summary"]

        # Post-output prescriptive check
        prescriptive_flags = check_output_prescriptive(summary_json)
        if prescriptive_flags:
            summary_json.setdefault("common_misconceptions", [])
            summary_json["_prescriptive_flags"] = prescriptive_flags

        try:
            haiku = verify_with_haiku(top["text"], summary_json)
        except Exception as e:
            haiku = {
                "overall_faithfulness_score": None,
                "requires_human_review": True,
                "red_flags": [str(e)],
            }

        text_blob = " ".join([
            summary_json.get("tl_dr", ""),
            summary_json.get("purpose", ""),
            " ".join(p.get("provision", "") for p in summary_json.get("key_provisions", [])),
        ])
        summary_json["grade_level"] = round(
            textstat.flesch_kincaid_grade(text_blob) if text_blob.strip() else 8.0, 1
        )

        return {
            "section": top["section"],
            "source_text": top["text"],
            "summary": summary_json,
            "faithfulness_score": haiku.get("overall_faithfulness_score"),
            "requires_review": haiku.get("requires_human_review", True),
            "red_flags": haiku.get("red_flags", []),
            "sonnet_usage": sonnet["usage"],
        }

    if search_clicked and query.strip():
        from app.sanitizer import sanitize_query
        clean_query, warning = sanitize_query(query.strip())

        if warning and not clean_query:
            st.error(warning)
        else:
            if warning:
                st.markdown(notice_html(warning, "warning"), unsafe_allow_html=True)

            with st.spinner("Retrieving sections · Generating explanation · Verifying accuracy…"):
                try:
                    result = run_query(selected_key, clean_query, custom_persona)
                    st.session_state.update({
                        "last_result": result,
                        "last_query": clean_query,
                        "last_bill": selected_key,
                    })
                    st.session_state.pop("verdict_results", None)
                except Exception as e:
                    st.error(f"Error: {e}")
                    st.session_state.pop("last_result", None)

    elif search_clicked:
        st.warning("Please enter a question first.")

    # ── Results ───────────────────────────────────────────────────────────
    if "last_result" in st.session_state:
        result = st.session_state["last_result"]
        summary = result["summary"]

        st.markdown('<div style="margin-top:1.25rem;"></div>', unsafe_allow_html=True)

        # ── Stat bar ──────────────────────────────────────────────────────
        grade = summary.get("grade_level", "—")
        score = result.get("faithfulness_score")
        score_display = f"{score:.1f}/5" if score is not None else "N/A"
        score_colour = "#16a34a" if (score or 0) >= 4.0 else "#dc2626"

        st.markdown(
            f"""
<div class="sh-card" style="display:flex;align-items:center;justify-content:space-between;
     flex-wrap:wrap;gap:1rem;padding:1rem 1.5rem;">
  <div>
    <p style="margin:0;font-size:0.75rem;color:#71717a;font-weight:500;
              text-transform:uppercase;letter-spacing:0.05em;">Section</p>
    <p style="margin:0;font-size:1rem;font-weight:600;color:#09090b;">
      {result['section']}
    </p>
  </div>
  <div style="display:flex;gap:2rem;">
    <div style="text-align:center;">
      <p style="margin:0;font-size:0.75rem;color:#71717a;font-weight:500;
                text-transform:uppercase;letter-spacing:0.05em;">Reading Grade</p>
      <p style="margin:0;font-size:1.375rem;font-weight:700;color:#09090b;">
        {grade}<span style="font-size:0.875rem;color:#71717a;">/18</span>
      </p>
    </div>
    <div style="text-align:center;">
      <p style="margin:0;font-size:0.75rem;color:#71717a;font-weight:500;
                text-transform:uppercase;letter-spacing:0.05em;">AI Accuracy</p>
      <p style="margin:0;font-size:1.375rem;font-weight:700;color:{score_colour};">
        {score_display}
      </p>
    </div>
  </div>
</div>
""",
            unsafe_allow_html=True,
        )

        if result.get("requires_review"):
            st.markdown(
                notice_html("Faithfulness score below threshold — treat with extra caution.", "warning"),
                unsafe_allow_html=True,
            )

        # ── Prescriptive output flag ───────────────────────────────────────
        if summary.get("_prescriptive_flags"):
            st.markdown(
                notice_html(
                    "The AI summary contained prescriptive language ('you should…') which was flagged. "
                    "The information below is for awareness only — not a recommendation.",
                    "warning",
                ),
                unsafe_allow_html=True,
            )

        # ── Split pane ────────────────────────────────────────────────────
        left, right = st.columns([1, 1], gap="large")

        with left:
            tl_dr = summary.get("tl_dr", "")
            purpose = summary.get("purpose", "")

            st.markdown(
                f'<div class="sh-card" style="background:#eff6ff;border-color:#bfdbfe;">'
                f'<p style="margin:0 0 0.25rem;font-size:0.75rem;font-weight:600;'
                f'color:#1d4ed8;text-transform:uppercase;letter-spacing:0.05em;">TL;DR</p>'
                f'<p style="margin:0;font-size:0.9375rem;font-weight:500;color:#1e3a5f;">{tl_dr}</p>'
                f'</div>',
                unsafe_allow_html=True,
            )

            if purpose:
                st.markdown(
                    f'<p style="font-size:0.875rem;color:#3f3f46;margin:0.75rem 0;">{purpose}</p>',
                    unsafe_allow_html=True,
                )

            provisions = summary.get("key_provisions", [])
            if provisions:
                st.markdown(
                    '<p style="font-size:0.75rem;font-weight:600;color:#71717a;'
                    'text-transform:uppercase;letter-spacing:0.05em;margin:1rem 0 0.5rem;">'
                    'KEY PROVISIONS</p>',
                    unsafe_allow_html=True,
                )
                for prov in provisions:
                    with st.expander(f"{prov.get('provision', '')[:75]}…"):
                        st.markdown(f"**Rule:** {prov.get('provision', '')}")
                        st.markdown(
                            f'<span style="font-size:0.75rem;background:#f4f4f5;'
                            f'padding:0.125rem 0.5rem;border-radius:0.25rem;'
                            f'color:#52525b;">{prov.get("source_section","")}</span>',
                            unsafe_allow_html=True,
                        )
                        eg = prov.get("concrete_example", "")
                        if eg:
                            st.markdown(
                                f'<p style="font-size:0.8125rem;color:#3f3f46;'
                                f'border-left:3px solid #e4e4e7;padding-left:0.75rem;'
                                f'margin-top:0.5rem;">{eg}</p>',
                                unsafe_allow_html=True,
                            )

            impacts = summary.get("persona_impacts", [])
            show_impacts = [
                i for i in impacts
                if i.get("persona", "").lower() in (selected_persona.lower(), "general user")
            ] or impacts

            if show_impacts:
                st.markdown(
                    f'<p style="font-size:0.75rem;font-weight:600;color:#71717a;'
                    f'text-transform:uppercase;letter-spacing:0.05em;margin:1rem 0 0.5rem;">'
                    f'FOR {selected_persona.upper()}</p>',
                    unsafe_allow_html=True,
                )
                for imp in show_impacts:
                    with st.expander(f"{imp.get('persona', selected_persona)}"):
                        st.markdown(imp.get("concrete_impact", ""))
                        tl = imp.get("timeline")
                        if tl:
                            st.markdown(
                                f'<span style="font-size:0.75rem;color:#71717a;">Timeline: {tl}</span>',
                                unsafe_allow_html=True,
                            )
                        info = imp.get("no_recommendation_only_info")
                        if info:
                            st.markdown(
                                notice_html(info, "info"), unsafe_allow_html=True
                            )

            misconceptions = summary.get("common_misconceptions", [])
            if misconceptions:
                with st.expander("Common Misconceptions"):
                    for m in misconceptions:
                        st.markdown(f"- {m}")

            if language == "Hindi":
                st.markdown("---")
                st.markdown(
                    '<p style="font-weight:600;">हिंदी अनुवाद</p>',
                    unsafe_allow_html=True,
                )
                with st.spinner("Translating via Bhashini…"):
                    try:
                        from app.translator import translate_to_hindi
                        st.markdown(
                            notice_html(f"<strong>सारांश:</strong> {translate_to_hindi(tl_dr)}", "info"),
                            unsafe_allow_html=True,
                        )
                        st.markdown(f"**उद्देश्य:** {translate_to_hindi(purpose)}")
                    except Exception as e:
                        st.caption(f"Hindi translation unavailable: {e}")

        with right:
            st.markdown(
                '<p style="font-size:0.75rem;font-weight:600;color:#71717a;'
                'text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">'
                'SOURCE TEXT</p>',
                unsafe_allow_html=True,
            )
            st.caption(BILLS[st.session_state["last_bill"]]["display_name"])
            st.text_area(
                label="Original bill text",
                value=result.get("source_text", "")[:3000],
                height=480,
                disabled=True,
                key="source_text_box",
                label_visibility="collapsed",
            )

        # ── Ambiguities ───────────────────────────────────────────────────
        ambiguities = summary.get("ambiguities", [])
        if ambiguities:
            st.markdown(
                '<p style="font-size:0.75rem;font-weight:600;color:#71717a;'
                'text-transform:uppercase;letter-spacing:0.05em;margin:1.25rem 0 0.25rem;">'
                'UNCLEAR CLAUSES</p>',
                unsafe_allow_html=True,
            )
            st.caption("These clauses have more than one possible meaning. Even lawyers disagree.")
            for i, amb in enumerate(ambiguities, 1):
                clause = amb.get("ambiguous_text", "Unclear clause")
                with st.expander(f"Unclear part {i} — {clause[:65]}…"):
                    st.markdown(
                        f'<blockquote style="border-left:3px solid #e4e4e7;'
                        f'padding-left:0.75rem;color:#52525b;font-style:italic;">'
                        f'{clause}</blockquote>',
                        unsafe_allow_html=True,
                    )
                    st.markdown(f"**Reading A:** {amb.get('interpretation_1', '')}")
                    if amb.get("interpretation_2"):
                        st.markdown(f"**Reading B:** {amb.get('interpretation_2', '')}")
                    if amb.get("expert_note"):
                        st.markdown(
                            notice_html(amb["expert_note"], "info"),
                            unsafe_allow_html=True,
                        )

        # ── Accuracy warnings ─────────────────────────────────────────────
        red_flags = result.get("red_flags", [])
        _ERR_HINTS = ("line ", "column ", "char ", "Expecting", "JSONDecodeError",
                      "json", "delimiter", "Unterminated", "truncated")
        parse_errors = [f for f in red_flags if any(h.lower() in f.lower() for h in _ERR_HINTS)]
        real_flags = [f for f in red_flags if f not in parse_errors]

        if parse_errors:
            with st.expander("AI Checker Could Not Run"):
                st.caption(
                    "The accuracy checker (Haiku) could not verify this summary. "
                    "Treat the summary above with extra care."
                )
        if real_flags:
            with st.expander("Accuracy Warnings"):
                st.caption("Haiku flagged these potential issues in the summary:")
                for flag in real_flags:
                    st.markdown(
                        notice_html(flag, "error"), unsafe_allow_html=True
                    )

        # ── Policy Verdict Panel ──────────────────────────────────────────
        st.markdown(
            '<p style="font-size:0.75rem;font-weight:600;color:#71717a;'
            'text-transform:uppercase;letter-spacing:0.05em;margin:1.25rem 0 0.25rem;">'
            'POLICY VERDICT — 5 PERSPECTIVES</p>',
            unsafe_allow_html=True,
        )
        st.caption(
            "Five Haiku agents — Economist, Social Worker, Legal Expert, Industry, Citizen — "
            "each read the same summary independently (~550 tokens each, run sequentially)."
        )

        v_btn, v_clr = st.columns([2, 1])
        with v_btn:
            run_verdict = st.button(
                "Run 5-Perspective Analysis", key="run_verdict_btn", use_container_width=True
            )
        with v_clr:
            if st.button("Clear", key="clear_verdict_btn", use_container_width=True):
                st.session_state.pop("verdict_results", None)
                st.rerun()

        if run_verdict:
            from app.verdict_agents import run_verdict_agents
            bill_name = BILLS[st.session_state["last_bill"]]["display_name"]
            verdicts = []
            bar = st.progress(0, text="Starting…")
            labels = ["Economist", "Social Worker", "Legal Expert", "Industry", "Citizen"]
            for i, vr in enumerate(run_verdict_agents(summary, bill_name)):
                verdicts.append(vr)
                bar.progress((i + 1) / 5, text=f"{labels[i]} done ({i+1}/5)")
            bar.empty()
            st.session_state["verdict_results"] = verdicts
            st.rerun()

        if "verdict_results" in st.session_state:
            from app.verdict_agents import verdict_style, AGENTS
            verdicts = st.session_state["verdict_results"]

            POSITIVE = {"positive", "protective", "robust", "business_friendly", "good_news"}
            NEGATIVE = {"concern", "exclusionary", "legally_risky", "burdensome", "bad_news"}
            pos = sum(1 for v in verdicts if v.get("verdict") in POSITIVE)
            neg = sum(1 for v in verdicts if v.get("verdict") in NEGATIVE)
            mix = len(verdicts) - pos - neg

            st.markdown(
                f"""
<div class="sh-card" style="display:flex;align-items:center;gap:1.5rem;padding:0.875rem 1.25rem;">
  <span style="font-size:0.8125rem;font-weight:600;color:#71717a;">Overall:</span>
  <span class="sh-badge sh-badge-green">{pos} Positive</span>
  <span class="sh-badge sh-badge-amber">{mix} Mixed</span>
  <span class="sh-badge sh-badge-red">{neg} Concern</span>
</div>
""",
                unsafe_allow_html=True,
            )

            FIELD_LABELS = {
                "positives": "Positives",
                "concerns": "Concerns",
                "who_is_protected": "Who is protected",
                "who_is_excluded": "Who may be excluded",
                "implementation_gap": "Implementation gap",
                "grassroots_note": "Ground-level note",
                "strengths": "Legal strengths",
                "gaps": "Legal gaps",
                "likely_litigation": "Likely court challenge",
                "constitutional_note": "Constitutional angle",
                "compliance_cost": "Compliance cost",
                "who_benefits": "Who benefits",
                "who_struggles": "Who struggles",
                "ease_of_doing_business": "Ease of doing business",
                "msme_note": "MSME note",
                "what_changes_for_me": "What changes",
                "what_stays_same": "What stays the same",
                "biggest_question": "Biggest question",
                "trust_level": "Trust level",
                "most_affected_sector": "Most affected sector",
                "fiscal_note": "Fiscal note",
            }

            for v in verdicts:
                vd = v.get("verdict", "neutral")
                bg, fg, icon = verdict_style(vd)
                headline = v.get("headline", "")
                label = v.get("agent_label", "Agent")

                with st.expander(f"{label} — {headline}"):
                    st.markdown(
                        f'<span class="sh-badge" style="background:{bg};color:{fg};">'
                        f'{icon} {vd.replace("_"," ").title()}</span>',
                        unsafe_allow_html=True,
                    )
                    skip = {"agent_id","agent_label","agent_description","verdict",
                            "headline","_usage","error","confidence"}
                    for key, friendly in FIELD_LABELS.items():
                        val = v.get(key)
                        if not val:
                            continue
                        if isinstance(val, list):
                            st.markdown(f"**{friendly}**")
                            for item in val:
                                st.markdown(f"- {item}")
                        else:
                            st.markdown(f"**{friendly}:** {val}")
                    conf = v.get("confidence")
                    if conf is not None:
                        st.progress(float(conf), text=f"Confidence {conf:.0%}")
                    if v.get("error"):
                        st.error(v["error"])

        # ── Cost expander ─────────────────────────────────────────────────
        with st.expander("Token & Cost Details"):
            usage = result.get("sonnet_usage", {})
            inp, out = usage.get("input_tokens", 0), usage.get("output_tokens", 0)
            cost = (inp * 3 + out * 15) / 1_000_000
            c1, c2, c3 = st.columns(3)
            c1.metric("Input tokens", f"{inp:,}")
            c2.metric("Output tokens", f"{out:,}")
            c3.metric("Est. cost", f"₹{cost*84:.2f}")
            st.caption("Sonnet 4.6 summary · Haiku 4.5 judge + verdict agents")

        # ── Footer disclaimer ─────────────────────────────────────────────
        st.markdown(
            notice_html(
                "AI-generated summary for informational purposes only. "
                "Not legal advice. Consult a qualified advocate before acting on any law. "
                "Source: India Code / Parliament of India · CC-BY 4.0",
                "warning",
            ),
            unsafe_allow_html=True,
        )

    else:
        # ── Empty state ───────────────────────────────────────────────────
        st.markdown('<div style="margin-top:1.5rem;"></div>', unsafe_allow_html=True)

        DEMO_QS = {
            "dpdp": ["What is personal data?", "What is a data fiduciary?",
                     "What are my rights under DPDP?"],
            "social_security": ["What benefits do gig workers get?",
                                 "Who is covered under social security?"],
            "bns": ["What is a cognizable offence?", "What are punishments for theft?"],
            "telecom": ["What is a licensed telecom entity?", "What is biometric KYC?"],
            "maha_rent": ["Can my landlord evict me?",
                          "How much deposit can my landlord ask for?",
                          "What repairs must my landlord do?"],
        }

        st.markdown(
            '<p style="font-size:0.75rem;font-weight:600;color:#71717a;'
            'text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.75rem;">'
            'TRY THESE QUESTIONS</p>',
            unsafe_allow_html=True,
        )
        for q in DEMO_QS.get(selected_key, []):
            if st.button(q, key=f"demo_{q}"):
                st.session_state["query_input"] = q
                st.rerun()

        st.markdown(
            '<div class="sh-card" style="margin-top:1.5rem;">'
            '<p style="margin:0 0 0.25rem;font-size:0.75rem;font-weight:600;'
            'color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">ROADMAP</p>'
            '<p style="margin:0;font-size:0.875rem;color:#3f3f46;">'
            'WhatsApp bot · All 22 scheduled languages · State laws · Bill comparison'
            '</p></div>',
            unsafe_allow_html=True,
        )


# ════════════════════════════════════════════════════════════════════════════
# TAB 2 — Browse State Bills
# ════════════════════════════════════════════════════════════════════════════
with tab_browse:
    try:
        all_rows, all_states, (yr_min, yr_max) = load_state_bills_data()
    except Exception as e:
        st.error(f"Could not load state bills: {e}")
        st.stop()

    # Hero stat
    st.markdown(
        f"""
<div style="background:linear-gradient(135deg,#18181b,#3f3f46);color:#fafafa;
     padding:1.5rem;border-radius:0.5rem;margin-bottom:1.25rem;">
  <p style="margin:0 0 0.25rem;font-size:0.75rem;font-weight:500;
            text-transform:uppercase;letter-spacing:0.1em;opacity:0.6;">
    DATASET
  </p>
  <h2 style="margin:0;font-size:2rem;font-weight:700;letter-spacing:-0.03em;">
    {len(all_rows):,} State Bills
  </h2>
  <p style="margin:0.25rem 0 0;font-size:0.875rem;opacity:0.7;">
    Across <strong>30 states &amp; UTs</strong> ·
    <strong>{yr_min}</strong> – <strong>{yr_max}</strong> ·
    Source: PRS Legislative Research
  </p>
</div>
""",
        unsafe_allow_html=True,
    )

    # Filters
    f1, f2, f3, f4 = st.columns([2, 1, 1, 2])
    with f1:
        state_filter = st.selectbox("State", ["All States"] + all_states, key="sb_state")
    with f2:
        year_from = st.number_input("From", min_value=yr_min, max_value=yr_max,
                                    value=yr_min, step=1, key="sb_yr_from")
    with f3:
        year_to = st.number_input("To", min_value=yr_min, max_value=yr_max,
                                  value=yr_max, step=1, key="sb_yr_to")
    with f4:
        keyword = st.text_input("Search", placeholder="rent, labour, education…", key="sb_kw")

    from app.state_bills import filter_bills
    filtered = filter_bills(
        state=state_filter if state_filter != "All States" else None,
        year_from=int(year_from), year_to=int(year_to), query=keyword,
    )

    st.markdown(
        f'<p style="font-size:0.8125rem;color:#71717a;margin:0.25rem 0 0.75rem;">'
        f'Showing <strong>{len(filtered):,}</strong> bills</p>',
        unsafe_allow_html=True,
    )

    import pandas as pd
    if filtered:
        df = pd.DataFrame(filtered)[["bill", "state", "date", "chamber"]]
        df.columns = ["Bill Name", "State", "Date", "Legislature"]
        st.dataframe(df.head(500), use_container_width=True, height=400, hide_index=True)

        if len(filtered) > 500:
            st.caption(f"Showing first 500 of {len(filtered):,}. Narrow your filters for more.")

        st.download_button(
            "Download filtered list (CSV)",
            data=df.to_csv(index=False).encode(),
            file_name="state_bills_filtered.csv",
            mime="text/csv",
        )
    else:
        st.markdown(
            notice_html("No bills match your filters. Try widening the year range or clearing the keyword.", "info"),
            unsafe_allow_html=True,
        )

    # Distribution chart
    st.markdown(
        '<p style="font-size:0.75rem;font-weight:600;color:#71717a;'
        'text-transform:uppercase;letter-spacing:0.05em;margin:1.25rem 0 0.5rem;">'
        'BILLS BY STATE</p>',
        unsafe_allow_html=True,
    )
    state_counts = {}
    for r in filtered:
        state_counts[r["state"]] = state_counts.get(r["state"], 0) + 1

    if state_counts:
        chart_df = (
            pd.DataFrame(list(state_counts.items()), columns=["State", "Bills"])
            .sort_values("Bills", ascending=False).head(15)
        )
        st.bar_chart(chart_df.set_index("State"))

    # Spotlight card
    st.markdown(
        """
<div class="sh-card" style="border-left:4px solid #18181b;margin-top:1.25rem;">
  <p style="margin:0 0 0.25rem;font-size:0.75rem;font-weight:600;color:#71717a;
            text-transform:uppercase;letter-spacing:0.05em;">SPOTLIGHT</p>
  <h3 style="margin:0 0 0.5rem;font-size:1rem;font-weight:600;color:#09090b;">
    Maharashtra Rent Control Act 1999
  </h3>
  <p style="margin:0 0 0.75rem;font-size:0.875rem;color:#3f3f46;">
    Over <strong>12 million households</strong> in Maharashtra rent their homes.
    This Act governs eviction, rent increases, deposits and tenant rights —
    yet most tenants have never read it.
  </p>
  <p style="margin:0;font-size:0.8125rem;color:#71717a;">
    Select <strong>Maharashtra Rent Control Act 1999 ★</strong> in the sidebar,
    switch to the <strong>Explain a Law</strong> tab, and ask:
    <em>"Can my landlord evict me?"</em>
  </p>
</div>
""",
        unsafe_allow_html=True,
    )
