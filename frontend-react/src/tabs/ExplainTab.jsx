import { useState, useRef } from 'react'
import { api } from '../api.js'
import { Badge } from '../components/Badge.jsx'
import SourceQuote from '../components/SourceQuote.jsx'
import { Spinner, LoadingCard } from '../components/Loader.jsx'

const PERSONAS = ['Farmer', 'Student', 'Gig Worker', 'Small Biz', 'Tenant', 'General']

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

const BILL_META = {
  dpdp:            { year: 2023, sector: 'Tech & Privacy',  clauses: '40+' },
  bns:             { year: 2023, sector: 'Criminal Law',    clauses: '358' },
  telecom:         { year: 2023, sector: 'Telecom',         clauses: '61'  },
  social_security: { year: 2020, sector: 'Labour',          clauses: '164' },
  maha_rent:       { year: 1999, sector: 'Housing',         clauses: '59'  },
}

function ScoreRing({ value, variant = 'green', label }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`ring-${variant}`}><span>{value}</span></div>
      <span className="text-[0.62rem] text-ink-3">{label}</span>
    </div>
  )
}

function PersonaImpactCard({ impact }) {
  if (impact.applies === false) {
    return (
      <div className="card card-na rounded-xl p-4">
        <span className="text-[0.65rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded"
              style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
          Not Directly Applicable
        </span>
        <p className="text-[0.88rem] text-ink-2 leading-relaxed mt-2">{impact.concrete_impact}</p>
      </div>
    )
  }
  return (
    <div className="card card-hover rounded-xl p-4">
      <div className="text-[0.65rem] text-ink-3 uppercase tracking-wider font-bold mb-1">{impact.persona}</div>
      <p className="text-[0.9rem] text-ink-1 leading-relaxed mb-2">{impact.concrete_impact}</p>
      {impact.timeline && (
        <p className="text-[0.78rem] text-ink-3 italic">{impact.timeline}</p>
      )}
      {impact.no_recommendation_only_info && (
        <p className="text-[0.78rem] text-amber-300 mt-1">{impact.no_recommendation_only_info}</p>
      )}
    </div>
  )
}

function HeroState({ bills, selectedBill, onQuickQuestion }) {
  const billName  = bills[selectedBill]?.display_name || 'Select a Bill'
  const questions = QUICK_QUESTIONS[selectedBill] || [
    'What are the main provisions?',
    'Who does this law apply to?',
    'What are my rights under this law?',
  ]

  return (
    <div className="animate-fade-up">
      {/* Hero card */}
      <div className="card-glow rounded-2xl p-7 mb-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px]"
             style={{ background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.5),rgba(99,102,241,0.3),transparent)' }} />
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(ellipse,rgba(245,158,11,0.07) 0%,transparent 70%)' }} />

        <div className="relative">
          <h2 className="font-display text-[1.7rem] font-bold mb-2 leading-tight"
              style={{ background: 'linear-gradient(135deg,#f8fafc,#fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Understand Any Indian Law
          </h2>
          <p className="text-[0.95rem] text-ink-2 leading-relaxed mb-5 max-w-lg">
            Ask a question about <span className="text-amber-300 font-medium">{billName}</span> in plain language.
            Get source-verified answers with persona-specific impacts.
          </p>

          {/* Feature list */}
          <div className="flex flex-col gap-0">
            {[
              { label: 'Source-verified quotes',   desc: 'Every claim backed by actual bill text',  color: '#10b981' },
              { label: 'Persona-specific impact',  desc: 'Tailored to your situation',              color: '#f59e0b' },
              { label: 'Dual AI verification',     desc: 'Sonnet generates, Haiku audits',          color: '#6366f1' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color, boxShadow: `0 0 6px ${f.color}80` }} />
                <div>
                  <span className="text-[0.84rem] font-semibold text-ink-1">{f.label}</span>
                  <span className="text-[0.78rem] text-ink-3 ml-2">{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick questions */}
      <div className="card-flat rounded-xl p-4">
        <span className="sec-label">Quick Questions · {billName}</span>
        <div className="flex flex-col gap-2">
          {questions.map(q => (
            <button key={q} onClick={() => onQuickQuestion(q)}
                    className="text-left w-full rounded-lg px-4 py-3 text-[0.88rem] text-ink-2 transition-all duration-150"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,158,11,0.25)'; e.currentTarget.style.background='rgba(245,158,11,0.04)'; e.currentTarget.style.color='#eef2f7' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.06)'; e.currentTarget.style.background='rgba(255,255,255,0.025)'; e.currentTarget.style.color='' }}>
              <span className="text-amber-400 font-bold mr-2">→</span>{q}
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
  const [query, setQuery]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const fileRef               = useRef()

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await api.summarize(selectedBill, query, selectedPersona || undefined)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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
  const meta    = BILL_META[selectedBill]

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: '230px 1fr 250px' }}>

      {/* ── Left sidebar: Bill + Persona ── */}
      <aside className="sticky top-[70px] rounded-xl p-4 border border-white/[0.07]"
             style={{ background: 'rgba(7,8,13,0.7)', alignSelf: 'start', maxHeight: 'calc(100vh - 90px)', overflowY: 'auto' }}>

        <span className="sec-label">Select Bill</span>
        <div className="relative mb-2">
          <select className="field pr-8" value={selectedBill} onChange={e => setSelectedBill(e.target.value)}>
            {Object.entries(bills).map(([k, v]) => (
              <option key={k} value={k}>{v.display_name}</option>
            ))}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="#8a9ab5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Tag + meta */}
        <div className="flex gap-1.5 flex-wrap mb-1">
          {bills[selectedBill]?.tag === 'Uploaded'
            ? <Badge variant="uploaded">Uploaded</Badge>
            : bills[selectedBill]?.tag?.includes('State')
              ? <Badge variant="state">{bills[selectedBill].tag}</Badge>
              : <Badge variant="central">Central</Badge>}
          <Badge variant="ok">Active</Badge>
        </div>
        {meta && (
          <div className="text-[0.72rem] text-ink-3 mb-5">{meta.year} · {meta.sector} · {meta.clauses} sections</div>
        )}

        <div className="divider">My Perspective</div>

        <div className="grid grid-cols-2 gap-1.5">
          {PERSONAS.map(p => (
            <button key={p}
                    onClick={() => setSelectedPersona(prev => prev === p ? '' : p)}
                    className={`persona-pill ${selectedPersona === p ? 'active' : ''}`}>
              {p}
            </button>
          ))}
        </div>

        {selectedPersona && (
          <button className="w-full mt-2 text-[0.72rem] text-ink-3 hover:text-ink-2 transition-colors"
                  onClick={() => setSelectedPersona('')}>
            Clear selection
          </button>
        )}
      </aside>

      {/* ── Center: Query + Results ── */}
      <div>
        {/* Query box */}
        <form onSubmit={handleSubmit} className="card-glow rounded-xl p-4 mb-5">
          <span className="sec-label">Ask About This Law</span>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-3" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l2.5 2.5" strokeLinecap="round"/>
              </svg>
              <input id="query-input" className="field pl-10 text-[0.92rem]" type="text"
                     value={query} onChange={e => setQuery(e.target.value)}
                     placeholder="e.g. How does this affect my Zomato account data?" />
            </div>
            <button type="submit" className="btn-amber whitespace-nowrap" disabled={loading || !query.trim()}>
              {loading ? <Spinner size={16} /> : 'Explain'}
            </button>
          </div>
          {selectedPersona && (
            <div className="mt-2 text-[0.75rem] text-ink-3">
              Perspective: <span className="text-amber-300 font-semibold">{selectedPersona}</span>
            </div>
          )}
        </form>

        {error && (
          <div className="rounded-xl p-4 mb-4 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
            <span className="text-[0.88rem] text-red-400">{error}</span>
          </div>
        )}

        {loading && <LoadingCard label="Sonnet is reading the law… Haiku is verifying…" />}

        {!result && !loading && (
          <HeroState bills={bills} selectedBill={selectedBill} onQuickQuestion={handleQuickQuestion} />
        )}

        {result && !loading && (
          <div className="animate-fade-up">

            {/* Summary header */}
            <div className="card card-hover rounded-xl p-6 mb-5">
              <div className="flex items-start gap-5 flex-wrap">
                <div className="flex-1">
                  <span className="sec-label">TL;DR</span>
                  <h2 className="font-display text-[1.3rem] text-ink-1 leading-snug mb-2.5">{summary?.tl_dr}</h2>
                  <p className="text-[0.92rem] text-ink-2 leading-relaxed">{summary?.purpose}</p>
                  <div className="flex gap-1.5 flex-wrap mt-3.5">
                    <Badge variant="central">{result.section}</Badge>
                    <Badge variant="grade">Grade {summary?.grade_level}</Badge>
                    {result.faithfulness_score >= 3.5
                      ? <Badge variant="ok">AI Score {result.faithfulness_score?.toFixed(1)}/5</Badge>
                      : <Badge variant="warn">AI Score {result.faithfulness_score?.toFixed(1)}/5</Badge>}
                    {result.requires_review && <Badge variant="warn">Review Suggested</Badge>}
                  </div>
                </div>
                <div className="flex flex-col gap-3 items-center shrink-0">
                  <ScoreRing value={result.faithfulness_score?.toFixed(1)}
                             variant={result.faithfulness_score >= 3.5 ? 'green' : 'blue'}
                             label="AI Score" />
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
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-[0.95rem] font-semibold text-ink-1 mb-1.5">{p.provision}</div>
                          {p.concrete_example && (
                            <div className="text-[0.85rem] text-ink-2 leading-relaxed mb-2">{p.concrete_example}</div>
                          )}
                          {p.source_section && <SourceQuote>{p.source_section}</SourceQuote>}
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
                  {summary.persona_impacts.map((p, i) => <PersonaImpactCard key={i} impact={p} />)}
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

            {/* Misconceptions */}
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

            {/* Haiku flags */}
            {result.red_flags?.length > 0 && (
              <div className="card-flat rounded-xl p-3 mb-4 border border-red-500/15">
                <span className="text-[0.68rem] font-bold text-red-400 uppercase tracking-wider">Verification flags</span>
                {result.red_flags.map((f, i) => (
                  <p key={i} className="text-[0.82rem] text-red-300 mt-1.5">{f}</p>
                ))}
              </div>
            )}

            <div className="rounded-lg px-4 py-3 text-[0.78rem] mt-2"
                 style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', color: '#92400e' }}>
              {result.disclaimer}
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel: Upload ── */}
      <aside className="sticky top-[70px] rounded-xl p-4 border border-white/[0.07]"
             style={{ background: 'rgba(7,8,13,0.7)', alignSelf: 'start', maxHeight: 'calc(100vh - 90px)', overflowY: 'auto' }}>

        <span className="sec-label">Upload Your Bill</span>

        <div className="upload-zone mb-3" onClick={() => fileRef.current?.click()}>
          {uploadedBill ? (
            <>
              <div className="text-[0.8rem] font-medium mb-0.5" style={{ color: '#6ee7b7' }}>
                {uploadedBill.display_name}
              </div>
              <div className="text-[0.68rem] text-ink-3">Click to replace</div>
            </>
          ) : (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3d4a61" strokeWidth="1.5" className="mx-auto mb-2">
                <path d="M12 16V8M12 8l-3 3M12 8l3 3" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="3" width="18" height="18" rx="4"/>
              </svg>
              <div className="text-[0.8rem] text-ink-3">Drop a bill PDF here</div>
              <div className="text-[0.68rem] text-ink-3 mt-0.5">or click to browse</div>
            </>
          )}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </div>

        {/* Tips */}
        <div className="rounded-lg p-3 mb-3"
             style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
          <div className="text-[0.68rem] font-bold text-indigo-300 uppercase tracking-wider mb-1.5">Upload Tips</div>
          <ul className="space-y-1.5">
            {['Text-based PDFs only (no scans)', 'State bills, gazette notifications', 'Max ~50 MB for best results'].map(t => (
              <li key={t} className="text-[0.73rem] text-ink-3 flex items-start gap-1.5">
                <span className="text-indigo-400 shrink-0 mt-0.5">·</span>{t}
              </li>
            ))}
          </ul>
        </div>

        {/* Divider */}
        <div className="divider">Pre-loaded Bills</div>

        {/* Coverage list */}
        <div className="flex flex-col gap-1.5">
          {[
            { name: 'DPDP Act 2023',          tag: 'Central' },
            { name: 'BNS 2023',                tag: 'Central' },
            { name: 'Telecom Act 2023',        tag: 'Central' },
            { name: 'Social Security 2020',    tag: 'Central' },
            { name: 'MH Rent Control 1999',   tag: 'State'   },
          ].map(b => (
            <div key={b.name} className="flex items-center justify-between rounded-lg px-3 py-2"
                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[0.76rem] text-ink-2">{b.name}</span>
              <Badge variant={b.tag === 'Central' ? 'central' : 'state'}>{b.tag}</Badge>
            </div>
          ))}
          <div className="text-[0.7rem] text-ink-3 text-center mt-1">
            + 23,000 state bills in Browse tab
          </div>
        </div>
      </aside>
    </div>
  )
}
