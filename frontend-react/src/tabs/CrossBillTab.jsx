import { useState } from 'react'
import { api } from '../api.js'
import { Badge, ConflictTypeBadge } from '../components/Badge.jsx'
import SourceQuote from '../components/SourceQuote.jsx'
import { Spinner, LoadingCard } from '../components/Loader.jsx'

const DEFAULT_BILLS = {
  dpdp:            'Digital Personal Data Protection Act 2023',
  social_security: 'Code on Social Security 2020',
  bns:             'Bharatiya Nyaya Sanhita 2023',
  telecom:         'Telecommunications Act 2023',
  maha_rent:       'Maharashtra Rent Control Act 1999',
}

function ConflictCard({ conflict, billAName, billBName }) {
  const borderColors = {
    direct_contradiction:  'rgba(239,68,68,0.25)',
    scope_overlap:         'rgba(245,158,11,0.2)',
    definitional_conflict: 'rgba(99,102,241,0.2)',
    procedural_gap:        'rgba(168,85,247,0.2)',
  }
  const bgColors = {
    direct_contradiction:  'rgba(239,68,68,0.05)',
    scope_overlap:         'rgba(245,158,11,0.05)',
    definitional_conflict: 'rgba(99,102,241,0.05)',
    procedural_gap:        'rgba(168,85,247,0.05)',
  }

  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: borderColors[conflict.conflict_type] || 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b"
           style={{ background: bgColors[conflict.conflict_type] || 'transparent', borderColor: borderColors[conflict.conflict_type] }}>
        <ConflictTypeBadge type={conflict.conflict_type} />
        <span className="text-[0.82rem] font-semibold text-ink-1">{conflict.description}</span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[0.62rem] text-indigo-300 uppercase font-bold tracking-wider mb-2">{billAName}</div>
          <p className="text-[0.78rem] text-ink-2 leading-relaxed mb-2">{conflict.bill_a_provision}</p>
          <SourceQuote>{conflict.bill_a_quote}</SourceQuote>
          <div className="mt-1.5">
            {conflict.quote_a_verified
              ? <Badge variant="ok">✓ Quote Verified</Badge>
              : <Badge variant="warn">⚠ Unverified</Badge>}
          </div>
        </div>
        <div>
          <div className="text-[0.62rem] text-indigo-300 uppercase font-bold tracking-wider mb-2">{billBName}</div>
          <p className="text-[0.78rem] text-ink-2 leading-relaxed mb-2">{conflict.bill_b_provision}</p>
          <SourceQuote>{conflict.bill_b_quote}</SourceQuote>
          <div className="mt-1.5">
            {conflict.quote_b_verified
              ? <Badge variant="ok">✓ Quote Verified</Badge>
              : <Badge variant="warn">⚠ Unverified</Badge>}
          </div>
        </div>
      </div>
      {conflict.legal_note && (
        <div className="px-4 pb-3">
          <p className="text-[0.73rem] text-ink-3 italic">Legal note: {conflict.legal_note}</p>
        </div>
      )}
    </div>
  )
}

export default function CrossBillTab({ bills }) {
  const billOptions = Object.keys(bills).length > 0 ? bills : DEFAULT_BILLS
  const keys = Object.keys(billOptions)

  const [billA, setBillA]   = useState(keys[0] || 'dpdp')
  const [billB, setBillB]   = useState(keys[3] || 'telecom')
  const [topic, setTopic]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  async function handleSubmit(e) {
    e?.preventDefault()
    if (billA === billB) { setError('Please select two different bills.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await api.detectConflicts(billA, billB, topic)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const conflicts = result?.conflicts?.filter(c => c.grounded) || []
  const ungrounded = result?.conflicts?.filter(c => !c.grounded) || []

  return (
    <div className="max-w-[980px] mx-auto">
      <h2 className="font-display text-[1.45rem] text-ink-1 mb-1">Cross-Bill Conflict Detector</h2>
      <p className="text-[0.82rem] text-ink-2 mb-5 leading-relaxed">
        Compare two bills for conflicts, overlaps, and definitional clashes. Every conflict requires verified quotes from both laws.
      </p>

      {/* Config card */}
      <form onSubmit={handleSubmit} className="card-flat rounded-xl p-4 mb-5">
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 36px 1fr' }}>
          <div>
            <label className="text-[0.74rem] text-ink-2 font-medium block mb-1.5">Bill A</label>
            <div className="relative">
              <select className="field pr-8" value={billA} onChange={e => setBillA(e.target.value)}>
                {Object.entries(billOptions).map(([k, v]) => (
                  <option key={k} value={k}>{typeof v === 'string' ? v : v.display_name}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="#8a9ab5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="flex items-end justify-center pb-2.5 text-ink-3 text-xl">⚔</div>
          <div>
            <label className="text-[0.74rem] text-ink-2 font-medium block mb-1.5">Bill B</label>
            <div className="relative">
              <select className="field pr-8" value={billB} onChange={e => setBillB(e.target.value)}>
                {Object.entries(billOptions).map(([k, v]) => (
                  <option key={k} value={k}>{typeof v === 'string' ? v : v.display_name}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="#8a9ab5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <input className="field flex-1" type="text" value={topic} onChange={e => setTopic(e.target.value)}
                 placeholder="Topic focus (optional) — e.g. data collection, surveillance, worker protections" />
          <button type="submit" className="btn-amber shrink-0" disabled={loading}>
            {loading ? <Spinner size={16} /> : 'Analyze →'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 mb-4 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
          <span className="text-[0.8rem] text-red-400">⚠ {error}</span>
        </div>
      )}

      {loading && <LoadingCard label="Retrieving sections and detecting conflicts…" />}

      {result && !loading && (
        <div className="animate-fade-up">

          {/* Insufficient grounding */}
          {result.insufficient_grounding && (
            <div className="card-flat rounded-xl p-5 mb-4 text-center">
              <p className="text-[0.85rem] text-ink-2 mb-1">⊘ Insufficient Evidence</p>
              <p className="text-[0.78rem] text-ink-3">{result.error || 'Not enough relevant sections found to generate verified conflicts.'}</p>
            </div>
          )}

          {/* Summary badges */}
          {!result.insufficient_grounding && (
            <div className="flex gap-2 flex-wrap mb-5 items-center">
              <span className="text-[0.75rem] text-ink-2">Conflicts found:</span>
              {result.conflicts?.filter(c => c.conflict_type === 'direct_contradiction').length > 0 && (
                <Badge variant="contradiction">
                  {result.conflicts.filter(c => c.conflict_type === 'direct_contradiction').length} Direct Contradiction
                </Badge>
              )}
              {result.conflicts?.filter(c => c.conflict_type === 'scope_overlap').length > 0 && (
                <Badge variant="overlap">
                  {result.conflicts.filter(c => c.conflict_type === 'scope_overlap').length} Scope Overlap
                </Badge>
              )}
              {result.conflicts?.filter(c => c.conflict_type === 'definitional_conflict').length > 0 && (
                <Badge variant="definitional">
                  {result.conflicts.filter(c => c.conflict_type === 'definitional_conflict').length} Definitional
                </Badge>
              )}
              {result.conflicts?.filter(c => c.conflict_type === 'procedural_gap').length > 0 && (
                <Badge variant="procedural">
                  {result.conflicts.filter(c => c.conflict_type === 'procedural_gap').length} Procedural Gap
                </Badge>
              )}
              <span className="text-[0.7rem] text-ink-3 ml-auto">
                {result.grounding_summary?.grounded}/{result.grounding_summary?.total} quote-verified
              </span>
            </div>
          )}

          {/* Grounded conflicts */}
          {conflicts.length > 0 && (
            <div className="flex flex-col gap-4 mb-4">
              {conflicts.map((c, i) => (
                <ConflictCard key={i} conflict={c}
                  billAName={result.bill_a_name}
                  billBName={result.bill_b_name} />
              ))}
            </div>
          )}

          {conflicts.length === 0 && !result.insufficient_grounding && (
            <div className="card-flat rounded-xl p-4 mb-4">
              <p className="text-[0.82rem] text-ink-2">No verified conflicts found for this topic. The bills may be compatible on this question, or the evidence in retrieved sections is insufficient.</p>
            </div>
          )}

          {/* Ungrounded (hidden by default) */}
          {ungrounded.length > 0 && (
            <div className="rounded-lg px-4 py-2.5 mb-4 text-[0.74rem]"
                 style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', color: '#b45309' }}>
              {ungrounded.length} conflict{ungrounded.length > 1 ? 's' : ''} hidden — quotes could not be verified against source text.
            </div>
          )}

          {/* Overlaps */}
          {result.overlaps?.length > 0 && (
            <>
              <span className="sec-label">Overlapping Provisions</span>
              <div className="flex flex-col gap-3 mb-4">
                {result.overlaps.map((o, i) => (
                  <div key={i} className="card-flat rounded-xl p-4">
                    <p className="text-[0.82rem] text-ink-1 font-medium mb-1">{o.topic}</p>
                    <p className="text-[0.78rem] text-ink-2">{o.explanation}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
