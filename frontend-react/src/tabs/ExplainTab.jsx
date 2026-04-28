import { useState, useRef } from 'react'
import { api } from '../api.js'
import { Badge, VerdictBadge } from '../components/Badge.jsx'
import SourceQuote from '../components/SourceQuote.jsx'
import { Spinner, LoadingCard } from '../components/Loader.jsx'

const PERSONAS = [
  { emoji: '👨‍🌾', label: 'Farmer' },
  { emoji: '🎓', label: 'Student' },
  { emoji: '🚗', label: 'Gig Worker' },
  { emoji: '🏪', label: 'Small Biz' },
  { emoji: '🏠', label: 'Tenant' },
  { emoji: '⚖', label: 'General' },
]

const QUICK_QUESTIONS = {
  dpdp: [
    'Can companies share my data without consent?',
    'What are my rights if my data is breached?',
    'How does this affect app developers?',
  ],
  bns: [
    'What replaced IPC Section 302?',
    'How does sedition law change under BNS?',
    'New provisions for organised crime?',
  ],
  telecom: [
    'Can the government intercept my calls?',
    'How are OTT apps regulated?',
    'What licenses do ISPs need?',
  ],
  social_security: [
    'Does this cover gig workers like Zomato delivery?',
    'What benefits do unorganised sector workers get?',
    'How is ESIC affected?',
  ],
  maha_rent: [
    'Can my landlord evict me without notice?',
    'How is fair rent calculated?',
    'Tenant rights in Mumbai under this act?',
  ],
}

const STATS = {
  dpdp:            { year: 2023, clauses: '40+', sector: 'Tech & Privacy' },
  bns:             { year: 2023, clauses: '358',  sector: 'Criminal Law' },
  telecom:         { year: 2023, clauses: '61',   sector: 'Telecom' },
  social_security: { year: 2020, clauses: '164',  sector: 'Labour' },
  maha_rent:       { year: 1999, clauses: '59',   sector: 'Housing' },
}

function ScoreRing({ value, variant = 'green', label }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`ring-${variant}`}>
        <span>{value}</span>
      </div>
      <span className="text-[0.62rem] text-ink-3">{label}</span>
    </div>
  )
}

function PersonaImpactCard({ impact }) {
  const applies = impact.applies !== false
  if (!applies) {
    return (
      <div className="card card-na rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded"
                style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
            ⚠ Not Directly Applicable
          </span>
        </div>
        <p className="text-[0.88rem] text-ink-2 leading-relaxed">{impact.concrete_impact}</p>
      </div>
    )
  }
  return (
    <div className="card card-hover rounded-xl p-4">
      <div className="text-[0.65rem] text-ink-3 uppercase tracking-wider font-bold mb-1">{impact.persona}</div>
      <p className="text-[0.9rem] text-ink-1 leading-relaxed mb-2">{impact.concrete_impact}</p>
      {impact.timeline && (
        <p className="text-[0.78rem] text-ink-3 italic">⏱ {impact.timeline}</p>
      )}
      {impact.no_recommendation_only_info && (
        <p className="text-[0.78rem] text-amber-300 mt-1">ℹ {impact.no_recommendation_only_info}</p>
      )}
    </div>
  )
}

function VerdictAgentCard({ agent }) {
  const positive = new Set(['positive','protective','robust','business_friendly','good_news'])
  const negative = new Set(['concern','exclusionary','legally_risky','burdensome','bad_news'])
  const v = agent.verdict || ''
  const isPos = positive.has(v)
  const isNeg = negative.has(v)
  const borderColor = isPos ? 'rgba(16,185,129,0.2)' : isNeg ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)'
  const bgColor     = isPos ? 'rgba(16,185,129,0.04)' : isNeg ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)'

  const details = Object.entries(agent)
    .filter(([k]) => !['agent_id','agent_label','agent_description','verdict','headline','confidence','_usage'].includes(k))
    .filter(([, v]) => v)

  return (
    <div className="rounded-xl p-4 border" style={{ borderColor, background: bgColor }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <span className="text-[0.78rem] font-bold" style={{ color: isPos ? '#6ee7b7' : isNeg ? '#fca5a5' : '#fcd34d' }}>
            {agent.agent_label}
          </span>
          {agent.confidence != null && (
            <span className="text-ink-3 text-[0.7rem] ml-2 font-mono">{(agent.confidence * 5).toFixed(1)}/5</span>
          )}
        </div>
        <VerdictBadge verdict={v} />
      </div>
      <p className="text-[0.85rem] text-ink-2 leading-relaxed mb-2">{agent.headline}</p>
      {details.slice(0, 2).map(([key, val]) => (
        <div key={key} className="text-[0.76rem] text-ink-3 mt-1">
          <span className="capitalize">{key.replace(/_/g, ' ')}: </span>
          {Array.isArray(val) ? val.join(' · ') : String(val).slice(0, 140)}
        </div>
      ))}
    </div>
  )
}

function HeroState({ bills, selectedBill, onQuickQuestion }) {
  const billKey   = selectedBill
  const billName  = bills[billKey]?.display_name || 'Select a Bill'
  const questions = QUICK_QUESTIONS[billKey] || [
    'What are the main provisions?',
    'Who does this law apply to?',
    'What are my rights under this law?',
  ]
  const stats = STATS[billKey]

  return (
    <div className="animate-fade-up">
      {/* Hero card */}
      <div className="card-glow rounded-2xl p-7 mb-5 text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 right-0 h-[2px]"
             style={{ background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.5),rgba(99,102,241,0.3),transparent)' }} />
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(ellipse,rgba(245,158,11,0.08) 0%,transparent 70%)' }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[0.72rem] font-semibold"
               style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
            ⚡ AI-Powered · Source-Grounded · Hallucination-Safe
          </div>
          <h2 className="font-display text-[1.8rem] font-bold mb-2 leading-tight"
              style={{ background: 'linear-gradient(135deg,#f8fafc,#fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Understand Any Indian Law
          </h2>
          <p className="text-[0.95rem] text-ink-2 leading-relaxed max-w-xl mx-auto mb-5">
            Ask a question about <span className="text-amber-300 font-medium">{billName}</span> in plain language.
            Get persona-specific impacts, source citations, and a 5-perspective verdict.
          </p>

          {/* Features row */}
          <div className="grid grid-cols-3 gap-3 text-left max-w-xl mx-auto">
            {[
              { icon: '📖', label: 'Source-verified quotes', desc: 'Every claim backed by actual bill text' },
              { icon: '🎯', label: 'Persona-specific', desc: 'Impact tailored to your situation' },
              { icon: '🤖', label: 'Dual AI verification', desc: 'Sonnet generates · Haiku audits' },
            ].map(f => (
              <div key={f.label} className="rounded-xl p-3 text-center"
                   style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xl mb-1.5">{f.icon}</div>
                <div className="text-[0.75rem] font-semibold text-ink-1 mb-0.5">{f.label}</div>
                <div className="text-[0.68rem] text-ink-3 leading-snug">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bill stats */}
      {stats && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { label: 'Year', value: stats.year },
            { label: 'Sections', value: stats.clauses },
            { label: 'Sector', value: stats.sector },
          ].map(s => (
            <div key={s.label} className="stat-chip flex-1 min-w-[100px] justify-between">
              <span className="text-ink-3">{s.label}</span>
              <span className="stat-chip-value">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quick questions */}
      <div className="card-flat rounded-xl p-4">
        <span className="sec-label">Quick Questions · {billName}</span>
        <div className="flex flex-col gap-2">
          {questions.map(q => (
            <button key={q}
                    onClick={() => onQuickQuestion(q)}
                    className="text-left w-full rounded-lg px-4 py-3 text-[0.88rem] text-ink-2 transition-all duration-150 group"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'; e.currentTarget.style.background = 'rgba(245,158,11,0.04)'; e.currentTarget.style.color = '#eef2f7' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.color = '' }}>
              <span className="text-amber-400 mr-2">→</span>
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ExplainTab({
  bills, selectedBill, setSelectedBill,
  selectedPersona, setSelectedPersona,
  uploadedBill, setUploadedBill,
}) {
  const [query, setQuery]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const [verdictLoading, setVL]     = useState(false)
  const [verdicts, setVerdicts]     = useState(null)
  const fileRef                     = useRef()

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null); setVerdicts(null)
    try {
      const data = await api.summarize(selectedBill, query, selectedPersona || undefined)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerdict() {
    if (!result) return
    setVL(true)
    try {
      const data = await api.runVerdict(result.summary, result.bill_display_name)
      setVerdicts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setVL(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await api.uploadPdf(file)
      setUploadedBill({ key: data.key, display_name: data.display_name })
      setSelectedBill(data.key)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
  }

  function handleQuickQuestion(q) {
    setQuery(q)
    setTimeout(() => document.getElementById('query-input')?.focus(), 50)
  }

  const summary = result?.summary

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: '280px 1fr' }}>

      {/* ── Sidebar ── */}
      <aside className="sticky top-[70px] rounded-xl p-5 border border-white/[0.07]"
             style={{ background: 'rgba(7,8,13,0.7)', alignSelf: 'start', maxHeight: 'calc(100vh - 90px)', overflowY: 'auto' }}>

        {/* Bill select */}
        <span className="sec-label">Configure Analysis</span>
        <div className="mb-3">
          <label className="text-[0.78rem] text-ink-2 font-medium block mb-1.5">Select Bill</label>
          <div className="relative">
            <select className="field pr-8" value={selectedBill} onChange={e => setSelectedBill(e.target.value)}>
              {Object.entries(bills).map(([k, v]) => (
                <option key={k} value={k}>{v.display_name}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="#8a9ab5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Bill tag */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {bills[selectedBill]?.tag === 'Uploaded'
            ? <Badge variant="uploaded">Uploaded PDF</Badge>
            : bills[selectedBill]?.tag?.includes('State')
              ? <Badge variant="state">{bills[selectedBill].tag}</Badge>
              : <Badge variant="central">Central</Badge>}
          <Badge variant="ok">● Active</Badge>
        </div>

        {/* Persona */}
        <label className="text-[0.78rem] text-ink-2 font-medium block mb-2">My Perspective</label>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {PERSONAS.map(p => (
            <button key={p.label}
                    onClick={() => setSelectedPersona(prev => prev === p.label ? '' : p.label)}
                    className={`persona-pill ${selectedPersona === p.label ? 'active' : ''}`}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>

        {/* Bill meta stats */}
        {STATS[selectedBill] && (
          <>
            <div className="divider">Bill Info</div>
            <div className="flex flex-col gap-1.5 mb-4">
              {[
                { icon: '📅', label: 'Year', val: STATS[selectedBill].year },
                { icon: '§', label: 'Sections', val: STATS[selectedBill].clauses },
                { icon: '🏛', label: 'Domain', val: STATS[selectedBill].sector },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between rounded-lg px-3 py-2"
                     style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-[0.76rem] text-ink-3">{s.icon} {s.label}</span>
                  <span className="text-[0.8rem] font-semibold font-mono text-amber-300">{s.val}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="divider">Upload Your Bill PDF</div>

        {/* Upload zone */}
        <div className="upload-zone" onClick={() => fileRef.current?.click()}>
          {uploadedBill ? (
            <>
              <div className="text-[0.8rem] font-medium mb-0.5" style={{ color: '#6ee7b7' }}>✓ {uploadedBill.display_name}</div>
              <div className="text-[0.68rem] text-ink-3">Click to replace</div>
            </>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3d4a61" strokeWidth="1.5" className="mx-auto mb-2">
                <path d="M12 16V8M12 8l-3 3M12 8l3 3" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="3" width="18" height="18" rx="4"/>
              </svg>
              <div className="text-[0.8rem] text-ink-3">Drop any bill PDF here</div>
              <div className="text-[0.68rem] text-ink-3 mt-0.5">or click to browse</div>
            </>
          )}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </div>

        {/* Upload tips */}
        <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
          <div className="text-[0.68rem] font-bold text-indigo-300 uppercase tracking-wider mb-1.5">📌 Upload Tips</div>
          <ul className="space-y-1">
            {['Text-based PDFs only (no scans)', 'State bills, gazette notifications', 'Max ~50MB for best results'].map(t => (
              <li key={t} className="text-[0.73rem] text-ink-3 flex items-start gap-1.5">
                <span className="text-indigo-400 mt-0.5">·</span>{t}
              </li>
            ))}
          </ul>
        </div>

        {/* Coverage note */}
        <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
          <div className="text-[0.68rem] font-bold text-amber-400 uppercase tracking-wider mb-1.5">📚 Coverage</div>
          <p className="text-[0.73rem] text-ink-3 leading-relaxed">
            4 central bills pre-indexed. Maharashtra Rent Control Act included. 23,000+ state bills browsable in the Browse tab.
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div>
        {/* Query box */}
        <form onSubmit={handleSubmit} className="card-glow rounded-xl p-4 mb-5">
          <span className="sec-label">Ask About This Law</span>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-3" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l2.5 2.5" strokeLinecap="round"/>
              </svg>
              <input id="query-input" className="field pl-10 text-[0.92rem]" type="text" value={query} onChange={e => setQuery(e.target.value)}
                     placeholder="e.g. How does this affect my Zomato account data?" />
            </div>
            <button type="submit" className="btn-amber whitespace-nowrap" disabled={loading || !query.trim()}>
              {loading ? <Spinner size={16} /> : 'Explain →'}
            </button>
          </div>
          {selectedPersona && (
            <div className="mt-2 text-[0.75rem] text-ink-3">
              Answering as: <span className="text-amber-300 font-semibold">{selectedPersona}</span>
              <button type="button" className="ml-2 text-ink-3 hover:text-ink-2" onClick={() => setSelectedPersona('')}>✕ clear</button>
            </div>
          )}
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-4 mb-4 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
            <span className="text-[0.88rem] text-red-400">⚠ {error}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && <LoadingCard label="Sonnet is reading the law… Haiku is verifying…" />}

        {/* Hero state — shown when no result yet */}
        {!result && !loading && (
          <HeroState bills={bills} selectedBill={selectedBill} onQuickQuestion={handleQuickQuestion} />
        )}

        {/* Results */}
        {result && !loading && (
          <div className="animate-fade-up">

            {/* Summary header */}
            <div className="card card-hover rounded-xl p-6 mb-5">
              <div className="flex items-start gap-5 flex-wrap">
                <div className="flex-1">
                  <span className="sec-label">TL;DR</span>
                  <h2 className="font-display text-[1.35rem] text-ink-1 leading-snug mb-2.5">{summary?.tl_dr}</h2>
                  <p className="text-[0.92rem] text-ink-2 leading-relaxed">{summary?.purpose}</p>
                  <div className="flex gap-1.5 flex-wrap mt-3.5">
                    <Badge variant="central">{result.section}</Badge>
                    <Badge variant="grade">Grade {summary?.grade_level}</Badge>
                    {result.faithfulness_score >= 3.5
                      ? <Badge variant="ok">✓ AI Score {result.faithfulness_score?.toFixed(1)}/5</Badge>
                      : <Badge variant="warn">⚠ AI Score {result.faithfulness_score?.toFixed(1)}/5</Badge>}
                    {result.requires_review && <Badge variant="warn">Review Suggested</Badge>}
                  </div>
                </div>
                <div className="flex flex-col gap-3 items-center shrink-0">
                  <ScoreRing
                    value={result.faithfulness_score?.toFixed(1)}
                    variant={result.faithfulness_score >= 3.5 ? 'green' : 'blue'}
                    label="AI Score"
                  />
                  <ScoreRing value={summary?.grade_level} variant="blue" label="Grade" />
                </div>
              </div>
            </div>

            {/* Key provisions */}
            {summary?.key_provisions?.length > 0 && (
              <>
                <span className="sec-label">Key Provisions</span>
                <div className="flex flex-col gap-3 mb-5">
                  {summary.key_provisions.map((p, i) => (
                    <div key={i} className="card card-hover rounded-xl p-5">
                      <div className="flex gap-3.5 items-start">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[0.82rem] font-bold"
                             style={{ background: 'rgba(245,158,11,0.12)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.2)' }}>
                          §{i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-[0.95rem] font-semibold text-ink-1 mb-1.5">{p.provision}</div>
                          {p.concrete_example && (
                            <div className="text-[0.85rem] text-ink-2 leading-relaxed mb-2">{p.concrete_example}</div>
                          )}
                          {p.source_section && (
                            <SourceQuote>{p.source_section}</SourceQuote>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Persona impacts */}
            {summary?.persona_impacts?.length > 0 && (
              <>
                <span className="sec-label">
                  {selectedPersona ? `Impact on ${selectedPersona}` : 'Persona Impacts'}
                </span>
                <div className="flex flex-col gap-3 mb-5">
                  {summary.persona_impacts.map((p, i) => (
                    <PersonaImpactCard key={i} impact={p} />
                  ))}
                </div>
              </>
            )}

            {/* Ambiguities */}
            {summary?.ambiguities?.length > 0 && (
              <>
                <span className="sec-label">Ambiguous Clauses</span>
                <div className="flex flex-col gap-3 mb-5">
                  {summary.ambiguities.map((a, i) => (
                    <div key={i} className="card rounded-xl p-5" style={{ borderColor: 'rgba(245,158,11,0.18)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fbbf24" strokeWidth="1.5">
                          <circle cx="7" cy="7" r="6"/><path d="M7 4.5v2.5M7 8.8v.5" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[0.85rem] font-semibold text-amber-300">"{a.ambiguous_text}"</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg p-3.5" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                          <div className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">Interpretation A</div>
                          <p className="text-[0.84rem] text-ink-2 leading-relaxed">{a.interpretation_1}</p>
                        </div>
                        {a.interpretation_2 && (
                          <div className="rounded-lg p-3.5" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-red-300 mb-1.5">Interpretation B</div>
                            <p className="text-[0.84rem] text-ink-2 leading-relaxed">{a.interpretation_2}</p>
                          </div>
                        )}
                      </div>
                      {a.expert_note && (
                        <p className="text-[0.78rem] text-ink-3 italic mt-2.5">Note: {a.expert_note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Common misconceptions */}
            {summary?.common_misconceptions?.length > 0 && (
              <>
                <span className="sec-label">Common Misconceptions</span>
                <div className="card-flat rounded-xl p-4 mb-5">
                  {summary.common_misconceptions.map((m, i) => (
                    <div key={i} className="text-[0.88rem] text-ink-2 leading-relaxed border-b border-white/[0.05] py-2.5 last:border-0 last:pb-0 first:pt-0">
                      {m}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Verdict Panel */}
            <span className="sec-label">5-Perspective Verdict Panel</span>
            {!verdicts && !verdictLoading && (
              <div className="card-glow rounded-xl p-5 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[0.92rem] font-medium text-ink-1 mb-0.5">Multi-Agent Policy Review</p>
                  <p className="text-[0.82rem] text-ink-2">5 independent perspectives: Economist · Social Worker · Legal Expert · Industry · Citizen</p>
                </div>
                <button className="btn-amber shrink-0 ml-4" onClick={handleVerdict}>Run Panel →</button>
              </div>
            )}
            {verdictLoading && <LoadingCard label="5 agents analysing independently…" />}
            {verdicts && (
              <div className="card-flat rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[0.8rem] text-ink-2">{verdicts.total} agents complete</span>
                  <div className="flex gap-1.5">
                    {verdicts.summary.positive > 0 && <Badge variant="ok">{verdicts.summary.positive} Positive</Badge>}
                    {verdicts.summary.mixed > 0    && <Badge variant="warn">{verdicts.summary.mixed} Mixed</Badge>}
                    {verdicts.summary.concern > 0  && <Badge variant="err">{verdicts.summary.concern} Concern</Badge>}
                  </div>
                </div>
                <div className="pbar-track mb-4">
                  <div className="pbar-fill" style={{ width: '100%' }} />
                </div>
                <div className="flex flex-col gap-2.5">
                  {verdicts.verdicts.map(v => <VerdictAgentCard key={v.agent_id} agent={v} />)}
                </div>
              </div>
            )}

            {/* Red flags */}
            {result.red_flags?.length > 0 && (
              <div className="card-flat rounded-xl p-3 mb-4 border border-red-500/15">
                <span className="text-[0.68rem] font-bold text-red-400 uppercase tracking-wider">Haiku flags</span>
                {result.red_flags.map((f, i) => (
                  <p key={i} className="text-[0.82rem] text-red-300 mt-1.5">{f}</p>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div className="rounded-lg px-4 py-3 text-[0.78rem] mt-2"
                 style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', color: '#92400e' }}>
              {result.disclaimer}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
