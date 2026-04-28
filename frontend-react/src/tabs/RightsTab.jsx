import { useState } from 'react'
import { api } from '../api.js'
import { Badge, ConfidenceBadge, GroundedBadge } from '../components/Badge.jsx'
import SourceQuote from '../components/SourceQuote.jsx'
import { Spinner, LoadingCard } from '../components/Loader.jsx'

function RightCard({ right }) {
  return (
    <div className="card card-hover rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="text-[0.88rem] font-semibold text-ink-1 leading-snug">{right.right}</div>
        <div className="flex gap-1.5 shrink-0 flex-wrap">
          <ConfidenceBadge confidence={right.confidence} />
          <GroundedBadge grounded={right.grounded} />
        </div>
      </div>
      <p className="text-[0.8rem] text-ink-2 leading-relaxed mb-2">{right.explanation}</p>
      {right.source_quote && <SourceQuote>{right.source_quote}</SourceQuote>}
      {right.action_info && (
        <p className="text-[0.74rem] text-amber-300 mt-2">ℹ {right.action_info}</p>
      )}
    </div>
  )
}

function DutyCard({ duty }) {
  return (
    <div className="card rounded-xl p-4" style={{ borderColor: 'rgba(245,158,11,0.15)' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="text-[0.85rem] font-semibold text-amber-300">{duty.duty}</div>
        <GroundedBadge grounded={duty.grounded} />
      </div>
      <p className="text-[0.8rem] text-ink-2 leading-relaxed">{duty.explanation}</p>
      {duty.source_quote && <SourceQuote>{duty.source_quote}</SourceQuote>}
    </div>
  )
}

export default function RightsTab({ uploadedBillKey }) {
  const [situation, setSituation] = useState('')
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!situation.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await api.checkRights(situation, uploadedBillKey)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const rights  = result?.your_rights  || []
  const duties  = result?.your_duties  || []
  const grounded = result?.grounding_summary

  return (
    <div className="max-w-[820px] mx-auto">
      <h2 className="font-display text-[1.45rem] text-ink-1 mb-1">What are your rights?</h2>
      <p className="text-[0.82rem] text-ink-2 mb-5 leading-relaxed">
        Describe your situation. We identify which laws apply and extract your rights — with exact source quotes, deterministically verified.
      </p>

      {/* Input */}
      <form onSubmit={handleSubmit} className="card-flat rounded-xl p-4 mb-5">
        <label className="text-[0.75rem] text-ink-2 font-medium block mb-1.5">Your Situation</label>
        <textarea className="field" value={situation} onChange={e => setSituation(e.target.value)}
          placeholder="e.g. I'm a gig delivery worker on Swiggy. My account was deactivated without notice and my pay was cut 30%. What rights do I have?" />
        <div className="flex justify-end mt-3">
          <button type="submit" className="btn-amber" disabled={loading || !situation.trim()}>
            {loading ? <Spinner size={16} /> : 'Check My Rights →'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 mb-4 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
          <span className="text-[0.8rem] text-red-400">⚠ {error}</span>
        </div>
      )}

      {loading && <LoadingCard label="Identifying relevant laws and extracting rights…" />}

      {result && !loading && (
        <div className="animate-fade-up">

          {/* Warning */}
          {result._warning && (
            <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-[0.78rem] text-amber-300">{result._warning}</p>
            </div>
          )}

          {/* Bills identified */}
          {result.bills_searched?.length > 0 && (
            <div className="mb-4">
              <span className="sec-label">Bills Identified (deterministic — no LLM cost)</span>
              <div className="flex gap-1.5 flex-wrap">
                {result.bills_searched.map(b => <Badge key={b} variant="central">{b}</Badge>)}
              </div>
            </div>
          )}

          {/* Grounding summary */}
          {grounded && (
            <div className="flex gap-3 mb-5 flex-wrap">
              <div className="card-flat rounded-lg px-3 py-2 text-center">
                <div className="font-mono text-lg text-ink-1 font-bold">{grounded.total_rights}</div>
                <div className="text-[0.65rem] text-ink-3 uppercase tracking-wider">Total</div>
              </div>
              <div className="card-flat rounded-lg px-3 py-2 text-center">
                <div className="font-mono text-lg text-emerald-300 font-bold">{grounded.grounded_rights}</div>
                <div className="text-[0.65rem] text-ink-3 uppercase tracking-wider">Verified</div>
              </div>
              <div className="card-flat rounded-lg px-3 py-2 text-center">
                <div className="font-mono text-lg text-amber-300 font-bold">{grounded.ungrounded_rights}</div>
                <div className="text-[0.65rem] text-ink-3 uppercase tracking-wider">Unverified</div>
              </div>
            </div>
          )}

          {/* Rights */}
          {rights.length > 0 ? (
            <>
              <span className="sec-label">{rights.length} Right{rights.length !== 1 ? 's' : ''} Found</span>
              <div className="flex flex-col gap-3 mb-5">
                {rights.map((r, i) => <RightCard key={i} right={r} />)}
              </div>
            </>
          ) : (
            <div className="card-flat rounded-xl p-4 mb-5">
              <p className="text-[0.82rem] text-ink-2">No specific rights extracted from available sections.</p>
            </div>
          )}

          {/* Duties */}
          {duties.length > 0 && (
            <>
              <span className="sec-label">Your Duties ({duties.length})</span>
              <div className="flex flex-col gap-3 mb-5">
                {duties.map((d, i) => <DutyCard key={i} duty={d} />)}
              </div>
            </>
          )}

          {/* What law doesn't cover */}
          {result.what_law_does_not_cover && (
            <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <span className="sec-label" style={{ color: '#fca5a5' }}>What the Law Does Not Cover</span>
              <p className="text-[0.8rem] text-ink-2 leading-relaxed whitespace-pre-line">{result.what_law_does_not_cover}</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-lg px-4 py-2.5 text-[0.74rem]"
               style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', color: '#92400e' }}>
            {result.disclaimer || 'This is plain-language information, not legal advice. For legal action, consult a qualified lawyer or contact NALSA at 15100 (free).'}
          </div>
        </div>
      )}
    </div>
  )
}
