import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'
import { Badge } from '../components/Badge.jsx'
import { Spinner } from '../components/Loader.jsx'

const PAGE_SIZE = 50

export default function BrowseTab() {
  const [state, setState]       = useState('')
  const [yearFrom, setYearFrom] = useState(1961)
  const [yearTo, setYearTo]     = useState(2024)
  const [keyword, setKeyword]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState(null)
  const [states, setStates]     = useState([])
  const [yearRange, setYearRange] = useState({ min: 1961, max: 2024 })

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.stateBills({ state, yearFrom, yearTo, query: keyword, limit: PAGE_SIZE })
      setData(res)
      if (res.states?.length) setStates(res.states)
      if (res.year_range) setYearRange(res.year_range)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [state, yearFrom, yearTo, keyword])

  useEffect(() => { fetch() }, [state, yearFrom, yearTo])

  function handleKeywordKey(e) {
    if (e.key === 'Enter') fetch()
  }

  function downloadCsv() {
    if (!data?.bills?.length) return
    const header = ['bill', 'state', 'date']
    const rows   = data.bills.map(b => header.map(h => `"${(b[h] || '').replace(/"/g, '""')}"`).join(','))
    const blob   = new Blob([header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href = url; a.download = 'state_bills.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const bills = data?.bills || []

  return (
    <div>
      {/* Filters */}
      <div className="card-flat rounded-xl p-4 mb-5">
        <div className="grid gap-4 items-end" style={{ gridTemplateColumns: '180px 1fr 1fr 1fr' }}>
          {/* State */}
          <div>
            <label className="text-[0.74rem] text-ink-2 font-medium block mb-1.5">State / UT</label>
            <div className="relative">
              <select className="field pr-8" value={state} onChange={e => setState(e.target.value)}>
                <option value="">All States</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="#8a9ab5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Year from */}
          <div>
            <label className="text-[0.74rem] text-ink-2 font-medium block mb-1.5">
              From: <span className="font-mono text-amber-glow">{yearFrom}</span>
            </label>
            <input type="range" min={yearRange.min} max={yearRange.max} value={yearFrom}
                   onChange={e => setYearFrom(Number(e.target.value))}
                   className="w-full" style={{ accentColor: '#f59e0b' }} />
          </div>

          {/* Year to */}
          <div>
            <label className="text-[0.74rem] text-ink-2 font-medium block mb-1.5">
              To: <span className="font-mono text-amber-glow">{yearTo}</span>
            </label>
            <input type="range" min={yearRange.min} max={yearRange.max} value={yearTo}
                   onChange={e => setYearTo(Number(e.target.value))}
                   className="w-full" style={{ accentColor: '#f59e0b' }} />
          </div>

          {/* Keyword */}
          <div>
            <label className="text-[0.74rem] text-ink-2 font-medium block mb-1.5">Keyword</label>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-3" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l2.5 2.5" strokeLinecap="round"/>
              </svg>
              <input className="field pl-8" type="text" value={keyword}
                     onChange={e => setKeyword(e.target.value)}
                     onKeyDown={handleKeywordKey}
                     placeholder="rent, labour, shops…" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {loading
            ? <span className="text-[0.85rem] text-ink-2 flex items-center gap-2"><Spinner size={14} /> Loading…</span>
            : <span className="text-[0.85rem] text-ink-2">
                Showing{' '}
                <span className="font-mono font-bold text-amber-glow">{bills.length}</span>
                {data?.total != null && data.total > bills.length && (
                  <> of <span className="font-mono font-bold text-amber-glow">{data.total}</span></>
                )}
                {' '}bills
              </span>}
          {state && <Badge variant="state">{state}</Badge>}
          {(yearFrom > yearRange.min || yearTo < yearRange.max) && (
            <Badge variant="grade">{yearFrom}–{yearTo}</Badge>
          )}
        </div>
        <button className="btn-ghost flex items-center gap-1.5" onClick={downloadCsv} disabled={!bills.length}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 10V3M7 10l-2.5-2.5M7 10l2.5-2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 12h12" strokeLinecap="round"/>
          </svg>
          Download CSV
        </button>
      </div>

      {/* Table */}
      <div className="card-flat overflow-hidden">
        {/* Header */}
        <div className="trow border-b border-white/[0.07]" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {['Bill Name', 'State', 'Year', 'Type'].map(h => (
            <div key={h} className="text-[0.62rem] text-ink-3 uppercase tracking-wider font-bold">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {bills.length === 0 && !loading && (
          <div className="px-4 py-10 text-center text-[0.82rem] text-ink-3">No bills match the current filters.</div>
        )}
        {bills.map((b, i) => (
          <div key={i} className="trow">
            <div>
              <div className="text-[0.83rem] font-semibold text-ink-1 leading-snug">{b.bill}</div>
              {b.state && <div className="text-[0.7rem] text-ink-3 mt-0.5">{b.state}</div>}
            </div>
            <Badge variant={b.state === 'Maharashtra' ? 'state' : 'state'} className="justify-self-start">
              {b.state}
            </Badge>
            <span className="font-mono text-[0.78rem] text-ink-2">{b.year || '—'}</span>
            <Badge variant="state" className="justify-self-start text-[0.6rem]">State</Badge>
          </div>
        ))}

        {/* Load more */}
        {data?.total > bills.length && (
          <div className="px-4 py-3 text-center text-[0.75rem] border-t border-white/[0.07]">
            <span className="text-ink-3">Showing first {PAGE_SIZE} results.</span>
            <button className="text-amber-glow ml-2 cursor-pointer" onClick={() => {}}>Load more</button>
          </div>
        )}
      </div>
    </div>
  )
}
