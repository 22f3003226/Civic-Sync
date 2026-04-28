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

function ScoreRing({ value, variant = 'green', label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`ring-${variant}`}>
        <span>{value}</span>
      </div>
      <span className="text-[0.6rem] text-ink-3">{label}</span>
    </div>
  )
}

function PersonaImpactCard({ impact }) {
  const applies = impact.applies !== false
  if (!applies) {
    return (
      <div className="card card-na rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[0.62rem] font-bold tracking-wider uppercase px-2 py-0.5 rounded"
                style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
            ⚠ Not Directly Applicable
          </span>
        </div>
        <p className="text-[0.8rem] text-ink-2 leading-relaxed">{impact.concrete_impact}</p>
      </div>
    )
  }
  return (
    <div className="card card-hover rounded-xl p-4">
      <div className="text-[0.62rem] text-ink-3 uppercase tracking-wider font-bold mb-1">{impact.persona}</div>
      <p className="text-[0.82rem] text-ink-1 leading-relaxed mb-2">{impact.concrete_impact}</p>
      {impact.timeline && (
        <p className="text-[0.74rem] text-ink-3 italic">⏱ {impact.timeline}</p>
      )}
      {impact.no_recommendation_only_info && (
        <p className="text-[0.74rem] text-amber-300 mt-1">ℹ {impact.no_recommendation_only_info}</p>
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
    <div className="rounded-xl p-3 border" style={{ borderColor, background: bgColor }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <span className="text-[0.72rem] font-bold" style={{ color: isPos ? '#6ee7b7' : isNeg ? '#fca5a5' : '#fcd34d' }}>
            {agent.agent_label}
          </span>
          {agent.confidence != null && (
            <span className="text-ink-3 text-[0.68rem] ml-2 font-mono">{(agent.confidence * 5).toFixed(1)}/5</span>
          )}
        </div>
        <VerdictBadge verdict={v} />
      </div>
      <p className="text-[0.78rem] text-ink-2 leading-relaxed mb-2">{agent.headline}</p>
      {details.slice(0, 2).map(([key, val]) => (
        <div key={key} className="text-[0.72rem] text-ink-3 mt-1">
          <span className="capitalize">{key.replace(/_/g, ' ')}: </span>
          {Array.isArray(val) ? val.join(' · ') : String(val).slice(0, 120)}
        </div>
      ))}
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
  const [hindiOn, setHindiOn]       = useState(false)
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

  const summary = result?.summary

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: '270px 1fr' }}>

      {/* ── Sidebar ── */}
      <aside className="sticky top-[74px] rounded-xl p-5 border border-white/[0.07]"
             style={{ background: 'rgba(7,8,13,0.7)', alignSelf: 'start' }}>
        <span className="sec-label">Configure</span>

        {/* Bill select */}
        <div className="mb-4">
          <label className="text-[0.75rem] text-ink-2 font-medium block mb-1.5">Select Bill</label>
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
        <div className="flex gap-1.5 flex-wrap mb-5">
          {bills[selectedBill]?.tag === 'Uploaded'
            ? <Badge variant="uploaded">Uploaded PDF</Badge>
            : bills[selectedBill]?.tag?.includes('State')
              ? <Badge variant="state">{bills[selectedBill].tag}</Badge>
              : <Badge variant="central">Central</Badge>}
          <Badge variant="ok">● Active</Badge>
        </div>

        {/* Persona */}
        <label className="text-[0.75rem] text-ink-2 font-medium block mb-2">My Perspective</label>
        <div className="grid grid-cols-2 gap-1.5 mb-5">
          {PERSONAS.map(p => (
            <button key={p.label}
                    onClick={() => setSelectedPersona(prev => prev === p.label ? '' : p.label)}
                    className={`persona-pill ${selectedPersona === p.label ? 'active' : ''}`}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>

        <div className="divider">Upload PDF</div>

        {/* Upload zone */}
        <div className="upload-zone" onClick={() => fileRef.current?.click()}>
          {uploadedBill ? (
            <>
              <div className="text-[0.75rem] font-medium mb-0.5" style={{ color: '#6ee7b7' }}>✓ {uploadedBill.display_name}</div>
              <div className="text-[0.65rem] text-ink-3">Click to replace</div>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3d4a61" strokeWidth="1.5" className="mx-auto mb-1.5">
                <path d="M12 16V8M12 8l-3 3M12 8l3 3" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="3" width="18" height="18" rx="4"/>
              </svg>
              <div className="text-[0.74rem] text-ink-3">Drop any bill PDF here</div>
              <div className="text-[0.65rem] text-ink-3 mt-0.5">or click to browse</div>
            </>
          )}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </div>

        {/* Hindi toggle */}
        <div className="flex items-center justify-between mt-3 px-3 py-2.5 rounded-lg border border-white/[0.07]"
             style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[0.74rem] text-ink-2">🇮🇳 Hindi Translation</span>
          <div className={`toggle ${hindiOn ? 'on' : ''}`} onClick={() => setHindiOn(p => !p)} />
        </div>
      </aside>

      {/* ── Main ── */}
      <div>
        {/* Query box */}
        <form onSubmit={handleSubmit} className="card-flat rounded-xl p-4 mb-5">
          <span className="sec-label">Ask About This Law</span>
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-3" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l2.5 2.5" strokeLinecap="round"/>
              </svg>
              <input className="field pl-9" type="text" value={query} onChange={e => setQuery(e.target.value)}
                     placeholder="e.g. How does this affect my Zomato account data?" />
            </div>
            <button type="submit" className="btn-amber whitespace-nowrap" disabled={loading || !query.trim()}>
              {loading ? <Spinner size={16} /> : 'Explain →'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-4 mb-4 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
            <span className="text-[0.8rem] text-red-400">⚠ {error}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && <LoadingCard label="Sonnet is reading the law… Haiku is verifying…" />}

        {/* Results */}
        {result && !loading && (
          <div className="animate-fade-up">

            {/* Summary header */}
            <div className="card card-hover rounded-xl p-5 mb-4">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1">
                  <span className="sec-label">TL;DR</span>
                  <h2 className="font-display text-[1.2rem] text-ink-1 leading-snug mb-2">{summary?.tl_dr}</h2>
                  <p className="text-[0.82rem] text-ink-2 leading-relaxed">{summary?.purpose}</p>
                  <div className="flex gap-1.5 flex-wrap mt-3">
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
                    <div key={i} className="card card-hover rounded-xl p-4">
                      <div className="flex gap-3 items-start">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[0.78rem] font-bold"
                             style={{ background: 'rgba(245,158,11,0.12)', color: '#fcd34d' }}>
                          §{i + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-[0.85rem] font-semibold text-ink-1 mb-1">{p.provision}</div>
                          {p.concrete_example && (
                            <div className="text-[0.78rem] text-ink-2 leading-relaxed mb-1">{p.concrete_example}</div>
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
                    <div key={i} className="card rounded-xl p-4" style={{ borderColor: 'rgba(245,158,11,0.18)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fbbf24" strokeWidth="1.5">
                          <circle cx="7" cy="7" r="6"/><path d="M7 4.5v2.5M7 8.8v.5" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[0.78rem] font-semibold text-amber-300">"{a.ambiguous_text}"</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg p-3" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
                          <div className="text-[0.62rem] font-bold uppercase tracking-wider text-emerald-300 mb-1">Interpretation A</div>
                          <p className="text-[0.77rem] text-ink-2 leading-relaxed">{a.interpretation_1}</p>
                        </div>
                        {a.interpretation_2 && (
                          <div className="rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                            <div className="text-[0.62rem] font-bold uppercase tracking-wider text-red-300 mb-1">Interpretation B</div>
                            <p className="text-[0.77rem] text-ink-2 leading-relaxed">{a.interpretation_2}</p>
                          </div>
                        )}
                      </div>
                      {a.expert_note && (
                        <p className="text-[0.73rem] text-ink-3 italic mt-2">Note: {a.expert_note}</p>
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
                    <div key={i} className="text-[0.8rem] text-ink-2 leading-relaxed border-b border-white/[0.05] py-2 last:border-0 last:pb-0 first:pt-0">
                      {m}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Verdict Panel */}
            <span className="sec-label">5-Perspective Verdict Panel</span>
            {!verdicts && !verdictLoading && (
              <div className="card-flat rounded-xl p-4 mb-4 flex items-center justify-between">
                <p className="text-[0.82rem] text-ink-2">Get 5 independent perspectives: Economist · Social Worker · Legal Expert · Industry · Citizen</p>
                <button className="btn-amber shrink-0 ml-4" onClick={handleVerdict}>Run Panel →</button>
              </div>
            )}
            {verdictLoading && <LoadingCard label="5 agents analysing independently…" />}
            {verdicts && (
              <div className="card-flat rounded-xl p-4 mb-4">
                {/* Summary */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[0.75rem] text-ink-2">{verdicts.total} agents complete</span>
                  <div className="flex gap-1.5">
                    {verdicts.summary.positive > 0 && <Badge variant="ok">{verdicts.summary.positive} Positive</Badge>}
                    {verdicts.summary.mixed > 0    && <Badge variant="warn">{verdicts.summary.mixed} Mixed</Badge>}
                    {verdicts.summary.concern > 0  && <Badge variant="err">{verdicts.summary.concern} Concern</Badge>}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="pbar-track mb-4">
                  <div className="pbar-fill" style={{ width: '100%' }} />
                </div>
                <div className="flex flex-col gap-2">
                  {verdicts.verdicts.map(v => <VerdictAgentCard key={v.agent_id} agent={v} />)}
                </div>
              </div>
            )}

            {/* Red flags */}
            {result.red_flags?.length > 0 && (
              <div className="card-flat rounded-xl p-3 mb-4 border border-red-500/15">
                <span className="text-[0.65rem] font-bold text-red-400 uppercase tracking-wider">Haiku flags</span>
                {result.red_flags.map((f, i) => (
                  <p key={i} className="text-[0.75rem] text-red-300 mt-1">{f}</p>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div className="rounded-lg px-4 py-2.5 text-[0.74rem] mt-2"
                 style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', color: '#92400e' }}>
              {result.disclaimer}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
