import { useState } from 'react'
import { api } from '../api.js'
import { Badge, VerdictBadge } from '../components/Badge.jsx'
import { Spinner, LoadingCard } from '../components/Loader.jsx'

const AGENTS = [
  { id: 'economist',   label: 'Economist',       color: '#6ee7b7' },
  { id: 'social',      label: 'Social Worker',    color: '#fcd34d' },
  { id: 'legal',       label: 'Legal Expert',     color: '#a5b4fc' },
  { id: 'industry',    label: 'Industry Analyst', color: '#fb923c' },
  { id: 'citizen',     label: 'Citizen',          color: '#94a3b8' },
]

function VerdictCard({ agent }) {
  const positive = new Set(['positive','protective','robust','business_friendly','good_news'])
  const negative = new Set(['concern','exclusionary','legally_risky','burdensome','bad_news'])
  const v        = agent.verdict || ''
  const isPos    = positive.has(v)
  const isNeg    = negative.has(v)
  const accentColor  = isPos ? '#6ee7b7' : isNeg ? '#fca5a5' : '#fcd34d'
  const borderColor  = isPos ? 'rgba(16,185,129,0.22)'  : isNeg ? 'rgba(239,68,68,0.22)'  : 'rgba(245,158,11,0.18)'
  const bgColor      = isPos ? 'rgba(16,185,129,0.04)'  : isNeg ? 'rgba(239,68,68,0.04)'  : 'rgba(245,158,11,0.03)'

  const extras = Object.entries(agent)
    .filter(([k]) => !['agent_id','agent_label','agent_description','verdict','headline','confidence','_usage'].includes(k))
    .filter(([, val]) => val)

  return (
    <div className="rounded-xl border transition-all duration-200 overflow-hidden"
         style={{ borderColor, background: bgColor }}>
      {/* Card header stripe */}
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg,${accentColor}60,transparent)` }} />

      <div className="p-5">
        {/* Agent label + verdict */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[0.85rem] font-bold mb-0.5" style={{ color: accentColor }}>
              {agent.agent_label}
            </div>
            {agent.agent_description && (
              <div className="text-[0.7rem] text-ink-3 leading-snug">{agent.agent_description}</div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {agent.confidence != null && (
              <span className="font-mono text-[0.72rem] text-ink-3">{(agent.confidence * 5).toFixed(1)}/5</span>
            )}
            <VerdictBadge verdict={v} />
          </div>
        </div>

        {/* Headline */}
        <p className="text-[0.92rem] text-ink-1 font-medium leading-snug mb-3">{agent.headline}</p>

        {/* Extra fields */}
        {extras.slice(0, 3).map(([key, val]) => (
          <div key={key} className="text-[0.78rem] text-ink-3 mt-1.5 leading-relaxed">
            <span className="text-ink-2 capitalize font-medium">{key.replace(/_/g, ' ')}: </span>
            {Array.isArray(val) ? val.join(' · ') : String(val).slice(0, 200)}
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentPlaceholder({ label, color }) {
  const initials = label.split(' ').map(w => w[0]).join('')
  return (
    <div className="rounded-xl p-5 border border-white/[0.06] text-center"
         style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="w-11 h-11 rounded-full mx-auto mb-3 flex items-center justify-center text-[0.78rem] font-bold"
           style={{ background: `${color}14`, border: `1px solid ${color}28`, color }}>
        {initials}
      </div>
      <div className="text-[0.85rem] font-semibold text-ink-2">{label}</div>
      <div className="text-[0.72rem] text-ink-3 mt-1">Awaiting analysis</div>
    </div>
  )
}

export default function VerdictTab({ bills }) {
  const billKeys  = Object.keys(bills)
  const [selectedBill, setBill] = useState(billKeys[0] || 'dpdp')
  const [focus, setFocus]       = useState('')
  const [step, setStep]         = useState(null)   // null | 'summarize' | 'verdict'
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)

  async function handleRun(e) {
    e?.preventDefault()
    setError(null); setResult(null)
    const query = focus.trim() || 'What are the key provisions, overall policy direction, and societal impact?'
    try {
      setStep('summarize')
      const summaryData = await api.summarize(selectedBill, query)
      setStep('verdict')
      const verdictData = await api.runVerdict(summaryData.summary, summaryData.bill_display_name)
      setResult({ ...verdictData, tl_dr: summaryData.summary?.tl_dr, bill_name: summaryData.bill_display_name })
    } catch (err) {
      setError(err.message)
    } finally {
      setStep(null)
    }
  }

  const isLoading = step !== null

  return (
    <div className="max-w-[1060px] mx-auto">

      {/* Page header */}
      <div className="mb-6">
        <h2 className="font-display text-[1.65rem] text-ink-1 mb-1.5">5-Perspective Policy Verdict</h2>
        <p className="text-[0.92rem] text-ink-2 leading-relaxed max-w-2xl">
          Five independent AI agents — each with a distinct lens — analyse the same bill and deliver a grounded verdict backed by source quotes.
        </p>
      </div>

      {/* Config card */}
      <form onSubmit={handleRun} className="card-glow rounded-xl p-5 mb-6">
        <div className="grid gap-4 items-end" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
          <div>
            <label className="text-[0.78rem] text-ink-2 font-medium block mb-1.5">Bill to Analyse</label>
            <div className="relative">
              <select className="field pr-8" value={selectedBill} onChange={e => setBill(e.target.value)} disabled={isLoading}>
                {Object.entries(bills).map(([k, v]) => (
                  <option key={k} value={k}>{typeof v === 'string' ? v : v.display_name}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="#8a9ab5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div>
            <label className="text-[0.78rem] text-ink-2 font-medium block mb-1.5">
              Focus Area <span className="text-ink-3 font-normal">(optional)</span>
            </label>
            <input className="field" type="text" value={focus} onChange={e => setFocus(e.target.value)}
                   placeholder="e.g. worker rights, data privacy, consumer impact"
                   disabled={isLoading} />
          </div>
          <button type="submit" className="btn-amber whitespace-nowrap" disabled={isLoading}>
            {isLoading ? <Spinner size={16} /> : 'Run Analysis'}
          </button>
        </div>

        {/* Agent pills */}
        <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-white/[0.06]">
          <span className="text-[0.72rem] text-ink-3 self-center mr-1">Agents:</span>
          {AGENTS.map(a => (
            <span key={a.id} className="text-[0.72rem] px-2.5 py-1 rounded-full font-medium"
                  style={{ background: `${a.color}12`, border: `1px solid ${a.color}28`, color: a.color }}>
              {a.label}
            </span>
          ))}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 mb-5 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
          <span className="text-[0.88rem] text-red-400">{error}</span>
        </div>
      )}

      {/* Loading steps */}
      {step === 'summarize' && <LoadingCard label="Retrieving key sections from the bill..." />}
      {step === 'verdict'   && <LoadingCard label="Running 5 independent agents — takes ~30 seconds..." />}

      {/* Results */}
      {result && !isLoading && (
        <div className="animate-fade-up">

          {/* Summary strip */}
          <div className="card-flat rounded-xl p-4 mb-4 flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="sec-label">Bill analysed</div>
              <div className="text-[0.98rem] font-semibold text-ink-1 mb-1">{result.bill_name}</div>
              {result.tl_dr && (
                <p className="text-[0.86rem] text-ink-2 leading-relaxed">{result.tl_dr}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap shrink-0 items-center">
              {result.summary?.positive > 0 && <Badge variant="ok">{result.summary.positive} Positive</Badge>}
              {result.summary?.mixed > 0    && <Badge variant="warn">{result.summary.mixed} Mixed</Badge>}
              {result.summary?.concern > 0  && <Badge variant="err">{result.summary.concern} Concern</Badge>}
              <span className="text-[0.72rem] text-ink-3">{result.total} agents</span>
            </div>
          </div>

          {/* Progress fill */}
          <div className="pbar-track mb-5">
            <div className="pbar-fill" style={{ width: '100%' }} />
          </div>

          {/* Verdict cards — 2 col grid */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))' }}>
            {result.verdicts?.map(v => <VerdictCard key={v.agent_id} agent={v} />)}
          </div>

          {/* Footer note */}
          <div className="mt-5 rounded-lg px-4 py-3 text-[0.76rem]"
               style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)', color: '#818cf8' }}>
            Each agent independently retrieves relevant sections from the bill and delivers a verdict grounded in source text.
            Agents run sequentially to stay within compute limits.
          </div>
        </div>
      )}

      {/* Empty placeholder */}
      {!result && !isLoading && !error && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {AGENTS.map(a => <AgentPlaceholder key={a.id} label={a.label} color={a.color} />)}
        </div>
      )}
    </div>
  )
}
