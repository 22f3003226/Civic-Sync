# Policy Explainer

**Indian legislation in plain language — built for the Anthropic Hackathon (Track 4: Governance & Collaboration)**

> Dense legal text that affects 1.4 billion people is readable by fewer than 1%. Policy Explainer bridges that gap using Claude to translate legislative PDFs into Grade 6 plain language with persona-specific impacts, source citations, ambiguity flagging, and hallucination prevention baked in at every layer.

---

## The Problem

Indian legislation is written in dense legal English that is effectively inaccessible to the people it governs. The Digital Personal Data Protection Act 2023 determines how every Indian's personal data may be used — yet fewer than 1% of the population can parse it. When citizens don't understand laws that affect them, they cannot exercise their rights, spot overreach, or hold institutions accountable.

Existing plain-language tools either hallucinate ("the law says you have the right to X" when it doesn't), strip too much nuance, or produce output only lawyers find useful. The challenge is not just simplification — it is *grounded* simplification that a Class 6 student can read while a lawyer can trace back to the source clause.

---

## How We Solved It

### Dual-model pipeline with adversarial verification

1. **Claude Sonnet 4.6** reads retrieved bill sections and generates a structured JSON summary targeting Flesch-Kincaid Grade 6–8
2. **Claude Haiku 4.5** acts as an independent faithfulness judge — it scores each claim 0–5 and flags anything that contradicts or fabricates from the source
3. Post-processing verifies source quotes deterministically (fuzzy word-overlap, no extra LLM call)
4. A five-perspective verdict panel (Economist, Social Worker, Legal Expert, Industry Rep, Citizen) each read the verified summary independently and return structured verdicts

### Retrieval before generation

The LLM never sees the full bill. A hybrid BM25 + Voyage AI (`voyage-law-2`) retriever finds the most relevant sections first. Only retrieved chunks — typically 600–3,500 characters — are passed to any LLM call. This keeps every call within token budget and forces the model to work from grounded evidence.

### Explicit non-applicability grounding

A common failure mode in persona-specific legal tools is stretching thin connections ("this factory worker provision might affect farmers too"). We prevent this with an `applies: boolean` field in every persona impact. When a section doesn't cover a persona, the model explicitly says so and the UI surfaces an amber "NOT DIRECTLY APPLICABLE" card — honest grounding over false reassurance.

---

## Features

### Explain a Law
- Select from 5 built-in bills or upload any PDF
- Ask a free-text question; the system retrieves the most relevant section
- Plain-language summary with: TL;DR (≤12 words), key provisions with real-life examples (WhatsApp, Zomato, UPI), ambiguous clauses with both interpretations, persona-specific impacts
- Flesch-Kincaid reading grade badge on every summary (target: Grade 6–8)
- AI accuracy score from Haiku faithfulness judge (0–5)
- Hindi translation via Bhashini ULCA NMT API (optional, non-blocking)

### Rights Checker
- Describe your situation in plain English
- Bills identified automatically by keyword matching (deterministic, no LLM cost)
- Each right returned has: a **source quote** (exact words from the statute), a confidence tier (CLEAR / LIKELY / UNCERTAIN), and a VERIFIED / UNVERIFIED badge from deterministic quote-grounding
- "What the law doesn't cover" is an explicit output field — surfaces gaps rather than inventing rights

### Cross-Bill Analysis
- Select any two bills and an optional topic
- Retrieves top-4 relevant sections from each bill independently
- Sonnet identifies conflicts by type: `direct_contradiction`, `scope_overlap`, `definitional_conflict`, `procedural_gap`
- Every conflict requires exact quotes from both bills; each quote independently verified against retrieved chunks
- `insufficient_grounding: true` blocks display when source evidence is too thin

### 5-Perspective Policy Verdict
- Five sequential Haiku agents (Economist, Social Worker, Legal Expert, Industry Rep, Citizen) each read the verified summary (~400 tokens)
- Runs sequentially to respect 10K input token org limit (~550 tokens per agent, ~2,750 total)
- Returns structured verdicts with confidence scores, streamed with a live progress bar
- Summary bar counts Positive / Mixed / Concern verdicts

### Browse State Bills
- 23,107 state bills from 30 states & UTs (1961–2024), sourced from PRS India JPI dataset
- Filter by state, year range, and keyword search
- Bills-by-state bar chart
- CSV download of filtered results
- Spotlight card: Maharashtra Rent Control Act 1999

### PDF Upload
- Upload any bill PDF directly from the sidebar
- Extracted in-memory via pdfplumber (no disk write, session-scoped)
- Chunked by section, BM25 retriever built instantly
- Uploaded bill appears in all three analysis tabs (Explain, Rights Checker, Cross-Bill)
- Image-scanned PDFs produce a clear error message with guidance

---

## Architecture

```
User query
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Sanitizer (app/sanitizer.py)                   │
│  • Injection pattern block (hard stop)          │
│  • Legal advice redirect (soft warning)         │
│  • Distress signal detection → helplines shown  │
└─────────────────────────────────────────────────┘
    │ clean query
    ▼
┌─────────────────────────────────────────────────┐
│  Hybrid Retriever (app/retrieval.py)            │
│  • BM25Okapi sparse retrieval (rank_bm25)       │
│  • Voyage AI voyage-law-2 dense embeddings      │
│  • Reciprocal Rank Fusion (k=60)                │
│  • Module-level singleton cache (read once)     │
│  • Lazy dense index (built on first query)      │
│  • Stable hashlib.md5 cache keys                │
└─────────────────────────────────────────────────┘
    │ top-k chunks (≤3,500 chars each)
    ▼
┌─────────────────────────────────────────────────┐
│  Claude Sonnet 4.6  (app/llm_handler.py)        │
│  • Structured JSON output (Pydantic-validated)  │
│  • Grade 6–8 writing rules enforced in prompt   │
│  • applies: boolean for persona non-applicability│
│  • max 12,000 chars input, temperature=0        │
└─────────────────────────────────────────────────┘
    │ summary JSON
    ▼
┌─────────────────────────────────────────────────┐
│  Haiku Faithfulness Judge (app/llm_handler.py)  │
│  • Scores each claim 0–5                        │
│  • Simplification ≠ inaccuracy (calibrated)     │
│  • approval: true if overall_score ≥ 3.5        │
│  • Slim input: tl_dr + purpose + ≤4 provisions  │
└─────────────────────────────────────────────────┘
    │ verified summary
    ▼
┌─────────────────────────────────────────────────┐
│  Output check (app/sanitizer.py)                │
│  • Prescriptive language scanner                │
│  • "you should hire/sue/file" → flagged in UI   │
└─────────────────────────────────────────────────┘
    │
    ▼
  Streamlit UI (frontend/streamlit_app.py)
  4 tabs · dark mode · shadcn design tokens
```

### Rights Checker data flow

```
Situation text
    → keyword bill identification (deterministic, no LLM)
    → BM25 retrieve top-3 per relevant bill (≤6 chunks total)
    → Sonnet extracts rights with mandatory source_quote per right
    → fuzzy word-overlap check (≥50% match required)
    → VERIFIED / UNVERIFIED badge per right in UI
```

### Cross-Bill Analysis data flow

```
(Bill A, Bill B, Topic)
    → BM25 retrieve top-4 from each bill independently
    → Sonnet identifies conflicts, must quote both bills (≥8 words each)
    → per-quote fuzzy verification against retrieved chunks
    → insufficient_grounding: true if evidence is too thin to show results
```

---

## Codebase Structure

```
Policy-Explainer/
│
├── app/
│   ├── conflict_detector.py  # Cross-bill conflict & overlap detection
│   ├── cost_tracker.py       # Per-call token + cost accounting (budget cap)
│   ├── llm_handler.py        # Sonnet summariser + Haiku faithfulness judge
│   ├── main.py               # FastAPI /summarize endpoint
│   ├── pdf_parser.py         # pdfplumber extraction, section chunking, bill registry
│   ├── prompts.py            # All system prompts: Sonnet, Haiku, conflict, rights, verdict
│   ├── retrieval.py          # HybridRetriever: BM25 + Voyage AI + RRF fusion
│   ├── rights_checker.py     # Situation → rights mapping with grounding verification
│   ├── sanitizer.py          # Input/output guardrails (injection, advice, distress, prescriptive)
│   ├── schemas.py            # Pydantic v2 models (BillSummary, PersonaImpact, Ambiguity, etc.)
│   ├── state_bills.py        # State bills CSV loader and filter helpers
│   ├── translator.py         # Bhashini ULCA NMT Hindi translation (optional, cached)
│   └── verdict_agents.py     # 5 sequential Haiku perspective agents
│
├── frontend/
│   ├── streamlit_app.py      # Full UI: 4 tabs, sidebar, PDF upload, dark mode
│   └── theme.py              # shadcn/zinc-dark CSS tokens, badge/notice/label helpers
│
├── bills/                    # Source PDFs (5 bills, git-tracked)
│   ├── Digital Personal Data Protection Act 2023.pdf
│   ├── Bharatiya Nyaya Sanhita 2023.pdf
│   ├── Telecommunications Act 2023.pdf
│   ├── Code on Social Security 2020.pdf
│   └── Maharashtra Rent Control Act, 1999.pdf
│
├── data/
│   ├── bills_states.csv          # 23,107 state bills, PRS India JPI dataset (1961–2024)
│   ├── bill_chunks_cache.json    # Pre-parsed section chunks (git-tracked, avoids re-parsing)
│   └── embeddings_cache.json     # Pre-generated Voyage AI embeddings (git-tracked, 24.7 MB)
│
├── tests/
│   └── test_all.py           # 7 checkpoint tests: schemas, PDF parsing, retrieval, prompts, cost
│
├── .streamlit/
│   └── config.toml           # Dark theme (zinc-950 palette)
├── requirements.txt
└── runtime.txt               # python-3.12 pin for Streamlit Cloud
```

---

## Security & Guardrails

### Input sanitization

| Threat | Detection | Response |
|---|---|---|
| Prompt injection | Regex: "ignore previous instructions", "jailbreak", "DAN mode", "reveal system prompt", "you are now a…" | Hard block — query rejected, error shown |
| Legal advice requests | Regex: "should I file/sue/appeal", "am I guilty", "can I win my case" | Soft redirect — disclaimer shown, query still processed |
| Distress signals | Regex: arrest, domestic violence, suicide, harassment, blackmail | Helplines surfaced prominently (iCall 9152987821, NALSA 15100, Women's 181) |
| Persona injection | Same injection patterns checked on custom persona text | Persona field stripped to empty string |

### Output scanning

A prescriptive language scanner checks every Sonnet output for phrases like "you should file a complaint", "immediately contact a lawyer", or "you must urgently". Flagged summaries display a UI warning badge making explicit that the content is information, not personal advice.

### Hallucination prevention — layered approach

| Layer | Mechanism |
|---|---|
| Retrieval-first | LLM only sees retrieved chunks (≤12,000 chars), never full bill |
| Mandatory source quotes | Rights Checker and Cross-Bill prompts require ≥8-word exact quotes from provided text |
| Deterministic verification | Post-processing fuzzy-matches every quote against retrieved chunks (≥50% key-word overlap). Zero extra API cost. |
| Adversarial judge | Haiku independently scores faithfulness 0–5; low scores trigger UI warning |
| Explicit non-applicability | `applies: false` + amber card when law doesn't cover the persona — no invented connections |
| Grounding gate | `insufficient_grounding: true` returns empty conflicts rather than fabricated ones |
| Political bias prevention | Prompts require neutral statements, prohibit predicting legislative intent, mandate both sides of controversial provisions |

### Compliance

- Sticky legal disclaimer on every response: "This is information, not legal advice"
- Flesch-Kincaid grade badge shows citizens how readable the summary is
- Hindi translation is optional and non-blocking — summary never waits on translation API
- Hard budget cap in `CostTracker` — app stops calling LLMs if spend exceeds limit

---

## Tech Stack

| Component | Technology |
|---|---|
| Primary LLM | Claude Sonnet 4.6 (`claude-sonnet-4-6`) |
| Judge / Verdict LLM | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Embeddings | Voyage AI `voyage-law-2` |
| Sparse retrieval | rank_bm25 BM25Okapi |
| Retrieval fusion | Reciprocal Rank Fusion (RRF, k=60) |
| PDF extraction | pdfplumber |
| Readability scoring | textstat (Flesch-Kincaid) |
| Translation | Bhashini ULCA NMT API (1,000 req/day free tier) |
| Backend | FastAPI + Pydantic v2 |
| Frontend | Streamlit 1.40 |
| Design | shadcn/ui zinc-dark CSS tokens, DM Sans + Inter + JetBrains Mono |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/22f3003226/Policy-Explainer.git
cd Policy-Explainer
pip install -r requirements.txt
```

### 2. Environment variables

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-...
VOYAGEAI_API_KEY=pa-...

# Optional — Hindi translation
BHASHINI_USER_ID=
BHASHINI_API_KEY=
```

### 3. Run

```bash
# Streamlit frontend (primary interface)
streamlit run frontend/streamlit_app.py

# FastAPI backend (optional REST endpoint)
uvicorn app.main:app --reload
```

### 4. Tests

```bash
pytest tests/test_all.py -v
```

---

## Performance

| Metric | Value |
|---|---|
| App startup | ~1 s (BM25 only; dense index lazy) |
| First query per bill | ~3 s (one Voyage AI query embedding call) |
| Repeat query | < 100 ms (from in-memory cache) |
| Document embeddings | Pre-generated; 0 Voyage API calls at startup |
| Tokens per full query | ~5,000 Sonnet + ~1,500 Haiku + ~2,750 verdict = ~9,250 total |
| Cache stability | hashlib.md5 keys survive Python restarts (not hash()) |

The `data/embeddings_cache.json` (24.7 MB) is committed to the repo so Streamlit Cloud deployments start with a fully warm cache — no cold embedding generation needed.

---

## Bills Included

| Bill | Year | Who It Affects |
|---|---|---|
| Digital Personal Data Protection Act | 2023 | Every Indian using apps, websites, or digital services |
| Bharatiya Nyaya Sanhita | 2023 | Criminal law — replaces the Indian Penal Code 1860 |
| Telecommunications Act | 2023 | Telecom operators, SIM holders, internet service providers |
| Code on Social Security | 2020 | Formal & gig economy workers, platform companies, employers |
| Maharashtra Rent Control Act | 1999 | 12M+ tenant households in Maharashtra |

---

## Hackathon Context

**Track**: 4 — Governance & Collaboration
**Institution**: IIT Madras (22f3003226@ds.study.iitm.ac.in)

**Key differentiators from other submissions:**
- Dual-model adversarial pipeline — Sonnet generates, Haiku judges independently
- Deterministic quote-grounding at zero extra API cost (fuzzy word-overlap post-processing)
- `applies: false` non-applicability grounding — honest gaps over stretched connections
- 5-perspective sequential verdict panel respecting org token limits
- Rights Checker: natural language situation → statutory rights with source quotes
- Cross-bill conflict detection with a typed conflict taxonomy
- User PDF upload integrated across all four analysis tabs
- Full dark-mode UI with shadcn design language
- Pre-generated embeddings committed to repo — warm cache on first Streamlit Cloud deploy
- Fixed Python `hash()` randomisation bug that caused cache misses on every restart
