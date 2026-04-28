import { useState, useEffect } from 'react'
import { api } from './api.js'
import ExplainTab from './tabs/ExplainTab.jsx'
import RightsTab from './tabs/RightsTab.jsx'
import CrossBillTab from './tabs/CrossBillTab.jsx'
import BrowseTab from './tabs/BrowseTab.jsx'

const TABS = [
  { id: 'explain',  label: '⚡ Explain a Law'      },
  { id: 'rights',   label: '🛡 Rights Checker'     },
  { id: 'cross',    label: '⚔ Cross-Bill Analysis' },
  { id: 'browse',   label: '📚 Browse State Bills'  },
]

export default function App() {
  const [activeTab, setActiveTab]         = useState('explain')
  const [bills, setBills]                 = useState({})
  const [selectedBill, setSelectedBill]   = useState('dpdp')
  const [selectedPersona, setSelectedPersona] = useState('')
  const [uploadedBill, setUploadedBill]   = useState(null) // {key, display_name}
  const [backendOk, setBackendOk]         = useState(null)

  useEffect(() => {
    api.health().then(() => setBackendOk(true)).catch(() => setBackendOk(false))
    api.listBills().then(setBills).catch(console.error)
  }, [])

  const allBills = {
    ...bills,
    ...(uploadedBill ? { [uploadedBill.key]: { display_name: uploadedBill.display_name, tag: 'Uploaded' } } : {}),
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ambient glow */}
      <div className="fixed top-[-15%] left-[20%] w-[60%] h-[50%] pointer-events-none"
           style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 65%)' }} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07]"
              style={{ background: 'rgba(7,8,13,0.88)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-[1380px] mx-auto px-6 flex items-center h-[58px] gap-5">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0 mr-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-base shrink-0"
                 style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#07080d' }}>
              PE
            </div>
            <div>
              <div className="font-display font-semibold text-[0.95rem] text-ink-1 leading-tight">Policy Explainer</div>
              <div className="text-[0.6rem] text-ink-3 tracking-[0.09em] uppercase">Indian Legislation · Plain Language</div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex flex-1 overflow-x-auto border-b border-white/[0.07] -mb-px">
            {TABS.map(t => (
              <button key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`relative px-5 py-3 text-[0.825rem] font-medium whitespace-nowrap transition-colors duration-200 border-none bg-transparent cursor-pointer font-sans
                                  ${activeTab === t.id ? 'text-ink-1' : 'text-ink-2 hover:text-ink-1'}`}>
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-t bg-amber-glow" />
                )}
              </button>
            ))}
          </nav>

          {/* Status */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {backendOk === false && (
              <span className="badge badge-err text-[0.6rem]">Backend offline</span>
            )}
            {backendOk === true && (
              <span className="badge badge-ok text-[0.6rem]">● Live</span>
            )}
            <span className="badge badge-central">Track 4</span>
            <span className="text-[0.7rem] text-ink-3 hidden sm:block">IIT Madras</span>
          </div>
        </div>
        <div className="h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.15) 40%,rgba(245,158,11,0.15) 60%,transparent)' }} />
      </header>

      {/* Content */}
      <main className="max-w-[1380px] mx-auto px-6 py-6 flex-1 w-full relative z-10">
        {activeTab === 'explain' && (
          <ExplainTab
            bills={allBills}
            selectedBill={selectedBill}
            setSelectedBill={setSelectedBill}
            selectedPersona={selectedPersona}
            setSelectedPersona={setSelectedPersona}
            uploadedBill={uploadedBill}
            setUploadedBill={setUploadedBill}
          />
        )}
        {activeTab === 'rights'  && <RightsTab uploadedBillKey={uploadedBill?.key} />}
        {activeTab === 'cross'   && <CrossBillTab bills={allBills} />}
        {activeTab === 'browse'  && <BrowseTab />}
      </main>

      {/* Disclaimer footer */}
      <footer className="relative z-10 py-3 px-6 mt-8"
              style={{ background: 'rgba(245,158,11,0.06)', borderTop: '1px solid rgba(245,158,11,0.15)' }}>
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-center gap-2">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#d97706" strokeWidth="1.5">
            <circle cx="7" cy="7" r="6"/><path d="M7 4.5v2.5M7 8.8v.5" strokeLinecap="round"/>
          </svg>
          <span className="text-[0.74rem] font-semibold" style={{ color: '#92400e' }}>Legal Disclaimer:</span>
          <span className="text-[0.74rem]" style={{ color: '#a16207' }}>
            This tool provides information only — not legal advice. For decisions affecting your rights, consult a qualified lawyer.
          </span>
          <span style={{ color: 'rgba(161,98,7,0.4)', margin: '0 4px' }}>·</span>
          {['iCall 9152987821', 'NALSA 15100', "Women's 181"].map(h => (
            <span key={h} className="text-[0.7rem] px-2 py-0.5 rounded font-mono"
                  style={{ color: '#92400e', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
              {h}
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}
