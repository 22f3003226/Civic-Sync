---
title: CivicSync
emoji: ⚖️
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# CivicSync — Policy Explainer

**🏆 1st place — Claude Builder Club Hackathon by Anthropic (Track 4: Governance & Collaboration)**

**Indian legislation in plain language, built for 1.4 billion people who can't read it.**

🔴 **[Live Demo](https://xytan2022-civicsync.hf.space)** &nbsp;|&nbsp; 💻 **[GitHub](https://github.com/22f3003226/Civic-Sync)**

---

## The Problem

Indian legislation is written in dense legal English inaccessible to the people it governs. The DPDP Act 2023 determines how every Indian's personal data gets used — yet fewer than 1% of the population can parse it. When citizens can't read laws that affect them, they can't exercise their rights, spot overreach, or hold institutions accountable.

Existing plain-language tools either hallucinate, strip too much nuance, or produce output only lawyers find useful. The challenge isn't just simplification — it's *grounded* simplification that a Class 6 student can read while a lawyer can trace back to the source clause.

---

## How It Works

### Dual-model pipeline with adversarial verification

1. **Claude Sonnet 4.6** reads retrieved bill sections and generates a structured JSON summary targeting Flesch-Kincaid Grade 6–8
2. **Claude Haiku 4.5** acts as an independent faithfulness judge — scores each claim 0–5 and flags anything that contradicts or fabricates from the source
3. Post-processing verifies source quotes deterministically (fuzzy word-overlap, no extra LLM call)
4. A five-perspective verdict panel (Economist, Social Worker, Legal Expert, Industry Rep, Citizen) each read the verified summary independently and return structured verdicts

### Retrieval before generation

The LLM never sees the full bill. A hybrid BM25 + Voyage AI (`voyage-law-2`) retriever finds the most relevant sections first. Only retrieved chunks — typically 600–3,500 characters — are passed to any LLM call. This keeps every call within token budget and forces the model to work from grounded evidence.

### Explicit non-applicability grounding

A common failure mode in persona-specific legal tools is stretching thin connections. We prevent this with an `applies: boolean` field in every persona impact. When a section doesn't cover a persona, the model explicitly says so — honest grounding over false reassurance.

---

## Features

### Explain a Law
- Select from 6 built-in bills or upload any PDF
- Ask a free-text question; the system retrieves the most relevant section
- Plain-language summary: TL;DR (≤12 words), key provisions with real-life examples, ambiguous clauses with both interpretations, persona-specific impacts
- Flesch-Kincaid reading grade badge on every summary (target: Grade 6–8)
- AI accuracy score from Haiku faithfulness judge (0–5)
- Hindi translation via Bhashini ULCA NMT API (optional, non-blocking)

### Rights Checker
- Describe your situation in plain English
- Bills identified automatically by keyword matching (deterministic, no LLM cost)
- Each right returned has: a source quote (exact words from the statute), a confidence tier (CLEAR / LIKELY / UNCERTAIN), and a VERIFIED / UNVERIFIED badge from deterministic quote-grounding
- "What the law doesn't cover" is an explicit output field — surfaces gaps rather than inventing rights

### Cross-Bill Analysis
- Select any two bills and an optional topic
- Retrieves top-4 relevant sections from each bill independently
- Sonnet identifies conflicts by type: `direct_contradiction`, `scope_overlap`, `definitional_conflict`, `procedural_gap`
- Every conflict requires exact quotes from both bills; each quote independently verified
- `insufficient_grounding: true` blocks display when source evidence is too thin

### 5-Perspective Policy Verdict
- Five sequential Haiku agents (Economist, Social Worker, Legal Expert, Industry Rep, Citizen) each read the verified summary independently
- Returns structured verdicts with confidence scores
- Summary bar counts Positive / Mixed / Concern verdicts

### Browse State Bills
- 23,107 state bills from 30 states & UTs (1961–2024), sourced from PRS India JPI dataset
- Filter by state, year range, and keyword search
- CSV download of filtered results

### PDF Upload
- Upload any bill PDF directly from the UI
- Extracted in-memory via pdfplumber (no disk write, session-scoped)
- Chunked by section, BM25 retriever built instantly
- Uploaded bill appears across all analysis tabs

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
  React UI (frontend-react/src/)
  5 tabs · dark mode · Tailwind CSS
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

## Codebase

```
CivicSync/
│
├── app/
│   ├── conflict_detector.py  # Cross-bill conflict & overlap detection
│   ├── cost_tracker.py       # Per-call token + cost accounting (budget cap)
│   ├── llm_handler.py        # Sonnet summariser + Haiku faithfulness judge
│   ├── main.py               # FastAPI endpoints + serves React build
│   ├── pdf_parser.py         # pdfplumber extraction, section chunking, bill registry
│   ├── prompts.py            # All system prompts: Sonnet, Haiku, conflict, rights, verdict
│   ├── retrieval.py          # HybridRetriever: BM25 + Voyage AI + RRF fusion
│   ├── rights_checker.py     # Situation → rights mapping with grounding verification
│   ├── sanitizer.py          # Input/output guardrails (injection, advice, distress, prescriptive)
│   ├── schemas.py            # Pydantic v2 models
│   ├── state_bills.py        # State bills CSV loader and filter helpers
│   ├── translator.py         # Bhashini ULCA NMT Hindi translation (optional, cached)
│   └── verdict_agents.py     # 5 sequential Haiku perspective agents
│
├── frontend-react/           # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js            # Typed API client
│   │   ├── tabs/             # ExplainTab, RightsTab, CrossBillTab, VerdictTab, BrowseTab
│   │   └── components/       # Badge, Loader, SourceQuote
│   ├── index.html
│   └── package.json
│
├── bills/                    # Source PDFs (6 bills)
│   ├── Digital Personal Data Protection Act 2023.pdf
│   ├── Bharatiya Nyaya Sanhita 2023.pdf
│   ├── Telecommunications Act 2023.pdf
│   ├── Code on Social Security 2020.pdf
│   ├── Maharashtra Rent Control Act, 1999.pdf
│   └── The National Sports Governance Act, 2025.pdf
│
├── data/
│   ├── bills_states.csv          # 23,107 state bills, PRS India JPI dataset (1961–2024)
│   └── bill_chunks_cache.json    # Pre-parsed section chunks (avoids re-parsing on startup)
│
├── Dockerfile                # Multi-stage: Node builds React → Python serves everything
└── requirements.txt
```

---

## Security & Guardrails

### Input sanitization

| Threat | Detection | Response |
|---|---|---|
| Prompt injection | Regex: "ignore previous instructions", "jailbreak", "DAN mode", "reveal system prompt" | Hard block — query rejected |
| Legal advice requests | Regex: "should I file/sue/appeal", "am I guilty", "can I win my case" | Soft redirect — disclaimer shown, query still processed |
| Distress signals | Regex: arrest, domestic violence, suicide, harassment, blackmail | Helplines surfaced (iCall 9152987821, NALSA 15100, Women's 181) |
| Persona injection | Same injection patterns checked on custom persona text | Persona field stripped |

### Hallucination prevention — layered

| Layer | Mechanism |
|---|---|
| Retrieval-first | LLM only sees retrieved chunks (≤12,000 chars), never the full bill |
| Mandatory source quotes | Rights Checker and Cross-Bill prompts require ≥8-word exact quotes |
| Deterministic verification | Post-processing fuzzy-matches every quote (≥50% keyword overlap). Zero extra API cost. |
| Adversarial judge | Haiku independently scores faithfulness 0–5; low scores trigger UI warning |
| Explicit non-applicability | `applies: false` + amber card when law doesn't cover the persona |
| Grounding gate | `insufficient_grounding: true` returns empty conflicts rather than fabricated ones |
| Political bias prevention | Prompts prohibit predicting legislative intent, mandate both sides of controversial provisions |

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
| Frontend | React 18 + Vite + Tailwind CSS |
| Hosting | Hugging Face Spaces (Docker) |

---

## Local Development

```bash
git clone https://github.com/22f3003226/CivicSync.git
cd CivicSync
pip install -r requirements.txt
```

Create `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
VOYAGEAI_API_KEY=pa-...

# Optional — Hindi translation
BHASHINI_USER_ID=
BHASHINI_API_KEY=
```

```bash
# Backend
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend-react && npm install && npm run dev
```

The Vite dev server proxies `/api/*` to `localhost:8000`.

---

## Performance

| Metric | Value |
|---|---|
| App startup | ~1 s (BM25 only; dense index lazy) |
| First query per bill | ~3 s (one Voyage AI query embedding call) |
| Repeat query | < 100 ms (from in-memory cache) |
| Tokens per full query | ~5,000 Sonnet + ~1,500 Haiku + ~2,750 verdict = ~9,250 total |
| Cache stability | hashlib.md5 keys survive Python restarts |

---

## Bills Included

| Bill | Year | Who It Affects |
|---|---|---|
| Digital Personal Data Protection Act | 2023 | Every Indian using apps, websites, or digital services |
| Bharatiya Nyaya Sanhita | 2023 | Criminal law — replaces the Indian Penal Code 1860 |
| Telecommunications Act | 2023 | Telecom operators, SIM holders, internet service providers |
| Code on Social Security | 2020 | Formal & gig economy workers, platform companies, employers |
| Maharashtra Rent Control Act | 1999 | 12M+ tenant households in Maharashtra |
| National Sports Governance Act | 2025 | Athletes, sports federations, NSFs |

---

## Hackathon

**Track**: 4 — Governance & Collaboration &nbsp;|&nbsp; **Result**: 🥇 1st place

**Key technical decisions:**
- Dual-model adversarial pipeline — Sonnet generates, Haiku judges independently
- Deterministic quote-grounding at zero extra API cost (fuzzy word-overlap post-processing)
- `applies: false` non-applicability field — honest gaps over stretched persona connections
- 5-perspective sequential verdict panel respecting org token limits
- Rights Checker: natural language situation → statutory rights with source quotes
- Cross-bill conflict detection with a typed conflict taxonomy (`direct_contradiction`, `scope_overlap`, `definitional_conflict`, `procedural_gap`)
- Fixed Python `hash()` randomisation bug that caused embedding cache misses on every restart
