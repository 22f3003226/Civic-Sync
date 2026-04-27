"""
Multi-perspective policy verdict agents.
Each agent reads only the pre-computed Sonnet summary (~400 tokens input).
Runs sequentially to stay within the 10K token org limit.
"""
import json
from typing import Dict, List, Generator
import anthropic
from app.cost_tracker import tracker

# Shared client (reuse from llm_handler pattern)
_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


# ── Agent definitions ──────────────────────────────────────────────────────
AGENTS = [
    {
        "id": "economist",
        "label": "💰 Economist",
        "description": "Economic & fiscal impact",
        "prompt": """You are an economist specialising in Indian public policy and development economics.
You will receive a plain-language summary of an Indian law section.
Analyse it from a purely economic lens: fiscal cost, market distortions, incentive effects, impact on GDP, employment, investment, and consumer welfare.

Be neutral — neither pro-market nor pro-state. Flag both positive economic effects and potential harms.

OUTPUT ONLY THIS JSON (no preamble):
{
  "verdict": "positive|mixed|concern",
  "headline": "<one sentence, under 15 words, economic bottom line>",
  "positives": ["<economic benefit 1>", "<economic benefit 2>"],
  "concerns": ["<economic risk 1>", "<economic risk 2>"],
  "most_affected_sector": "<which industry or sector feels this most>",
  "fiscal_note": "<any cost to government or taxpayer, or 'No direct fiscal impact'>",
  "confidence": <0.0-1.0, how confident given available information>
}"""
    },
    {
        "id": "social_worker",
        "label": "👷 Social Worker",
        "description": "Impact on vulnerable groups",
        "prompt": """You are a senior social worker with 20 years of experience working with marginalised communities in India — daily wage workers, women, tribal populations, people with disabilities, the elderly, and migrants.
You will receive a plain-language summary of an Indian law section.
Analyse it for its impact on the most vulnerable people: who is protected, who is excluded, what gaps exist, and whether implementation will actually reach those who need it.

OUTPUT ONLY THIS JSON (no preamble):
{
  "verdict": "protective|mixed|exclusionary",
  "headline": "<one sentence, under 15 words, social impact bottom line>",
  "who_is_protected": ["<group 1>", "<group 2>"],
  "who_is_excluded": ["<group at risk of falling through the gaps>"],
  "implementation_gap": "<biggest risk that this law won't reach people on the ground>",
  "grassroots_note": "<what a village-level worker or NGO would flag>",
  "confidence": <0.0-1.0>
}"""
    },
    {
        "id": "legal_expert",
        "label": "⚖️ Legal Expert",
        "description": "Enforceability & legal gaps",
        "prompt": """You are a senior advocate practising constitutional and administrative law in India, with experience in the Supreme Court and High Courts.
You will receive a plain-language summary of an Indian law section.
Analyse it for legal robustness: is it constitutionally sound? Are key terms defined? Are enforcement mechanisms clear? What litigation is likely?

Do not give legal advice. Flag structural issues, vagueness, and likely court challenges.

OUTPUT ONLY THIS JSON (no preamble):
{
  "verdict": "robust|needs_clarification|legally_risky",
  "headline": "<one sentence, under 15 words, legal bottom line>",
  "strengths": ["<legally sound aspect 1>", "<legally sound aspect 2>"],
  "gaps": ["<undefined term or missing mechanism>", "<another gap>"],
  "likely_litigation": "<what kind of challenge is most likely in court>",
  "constitutional_note": "<any fundamental rights angle — Article 14, 19, 21, etc.>",
  "confidence": <0.0-1.0>
}"""
    },
    {
        "id": "industry_rep",
        "label": "🏢 Industry",
        "description": "Compliance burden on business",
        "prompt": """You are a policy advisor representing Indian industry — covering MSMEs, startups, large corporations, and the informal sector.
You will receive a plain-language summary of an Indian law section.
Analyse the compliance burden, cost of implementation, impact on ease of doing business, and whether the law creates level playing field or advantages certain players.

Be balanced — acknowledge legitimate regulation while flagging genuine compliance concerns.

OUTPUT ONLY THIS JSON (no preamble):
{
  "verdict": "business_friendly|neutral|burdensome",
  "headline": "<one sentence, under 15 words, business impact bottom line>",
  "compliance_cost": "<estimated burden: low/medium/high and why>",
  "who_benefits": ["<type of business that gains>"],
  "who_struggles": ["<type of business that is burdened>"],
  "ease_of_doing_business": "<positive or negative effect and why>",
  "msme_note": "<specific impact on small businesses and informal sector>",
  "confidence": <0.0-1.0>
}"""
    },
    {
        "id": "citizen",
        "label": "👤 Common Citizen",
        "description": "Plain-language daily life impact",
        "prompt": """You are a 35-year-old Indian citizen — educated but not a specialist, living in a Tier-2 city, working a regular job, with a family to support.
You will receive a plain-language summary of an Indian law section.
React to it from the perspective of an ordinary person: what does this actually mean for daily life? Is this good news or bad news? What would most people misunderstand about this?

Speak in plain, conversational English. No jargon. Think like a WhatsApp message to a friend.

OUTPUT ONLY THIS JSON (no preamble):
{
  "verdict": "good_news|neutral|bad_news",
  "headline": "<one sentence reaction, under 15 words, conversational tone>",
  "what_changes_for_me": ["<concrete daily life change 1>", "<concrete daily life change 2>"],
  "what_stays_same": "<what people think will change but won't>",
  "biggest_question": "<the thing an ordinary person would immediately ask about this>",
  "trust_level": "<would a typical Indian trust this law to be enforced? Why or why not?>",
  "confidence": <0.0-1.0>
}"""
    },
]


# ── Main runner ────────────────────────────────────────────────────────────
def run_verdict_agents(summary_json: dict, bill_name: str) -> Generator[Dict, None, None]:
    """
    Run verdict agents one by one (sequential).
    Yields each agent result as it completes — enables streaming UI updates.

    Each agent receives only the pre-verified Sonnet summary (~400 tokens),
    NOT the raw bill text, keeping each call well under 10K input tokens.
    """
    slim = {
        "bill": bill_name,
        "tl_dr": summary_json.get("tl_dr", ""),
        "purpose": summary_json.get("purpose", ""),
        "key_provisions": [
            p.get("provision", "") for p in summary_json.get("key_provisions", [])
        ],
        "persona_impacts": [
            {"persona": i.get("persona"), "impact": i.get("concrete_impact")}
            for i in summary_json.get("persona_impacts", [])
        ],
        "ambiguities": [
            a.get("ambiguous_text", "") for a in summary_json.get("ambiguities", [])
        ],
    }
    payload = json.dumps(slim, indent=2)

    for agent in AGENTS:
        try:
            response = _get_client().messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=600,
                temperature=0,
                system=agent["prompt"],
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Analyse this law summary and return ONLY the JSON:\n\n{payload}"
                        ),
                    }
                ],
            )
            raw = response.content[0].text.strip()

            # Strip markdown fences if present
            import re
            fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw)
            if fence:
                raw = fence.group(1)
            brace = re.search(r"\{[\s\S]+\}", raw)
            if brace:
                raw = brace.group(0)

            result = json.loads(raw)
            result["agent_id"] = agent["id"]
            result["agent_label"] = agent["label"]
            result["agent_description"] = agent["description"]

            usage = {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }
            tracker.log_call("claude-haiku-4-5-20251001", usage["input_tokens"], usage["output_tokens"])
            result["_usage"] = usage

        except Exception as e:
            result = {
                "agent_id": agent["id"],
                "agent_label": agent["label"],
                "agent_description": agent["description"],
                "verdict": "error",
                "headline": f"Analysis unavailable: {str(e)[:60]}",
                "error": str(e),
            }

        yield result


# ── Verdict colour helpers ─────────────────────────────────────────────────
VERDICT_COLOURS = {
    # Economist
    "positive": ("#e8f5e9", "#2e7d32", "✅"),
    "mixed": ("#fff8e1", "#f57f17", "⚠️"),
    "concern": ("#ffebee", "#c62828", "🔴"),
    # Social worker
    "protective": ("#e8f5e9", "#2e7d32", "✅"),
    "exclusionary": ("#ffebee", "#c62828", "🔴"),
    # Legal
    "robust": ("#e8f5e9", "#2e7d32", "✅"),
    "needs_clarification": ("#fff8e1", "#f57f17", "⚠️"),
    "legally_risky": ("#ffebee", "#c62828", "🔴"),
    # Industry
    "business_friendly": ("#e8f5e9", "#2e7d32", "✅"),
    "neutral": ("#f3f4f6", "#374151", "➖"),
    "burdensome": ("#ffebee", "#c62828", "🔴"),
    # Citizen
    "good_news": ("#e8f5e9", "#2e7d32", "✅"),
    "bad_news": ("#ffebee", "#c62828", "🔴"),
    # Fallback
    "error": ("#f3f4f6", "#374151", "⚙️"),
}


def verdict_style(verdict: str):
    """Return (bg_color, text_color, icon) for a verdict string."""
    return VERDICT_COLOURS.get(verdict, ("#f3f4f6", "#374151", "➖"))
