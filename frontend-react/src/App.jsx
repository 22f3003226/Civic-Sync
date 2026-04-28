import { useState, useEffect } from 'react'
import { api } from './api.js'
import ExplainTab from './tabs/ExplainTab.jsx'
import RightsTab from './tabs/RightsTab.jsx'
import CrossBillTab from './tabs/CrossBillTab.jsx'
import BrowseTab from './tabs/BrowseTab.jsx'

const TABS = [
  { id: 'explain',  label: 'Explain a Law'      },
  { id: 'rights',   label: 'Rights Checker'      },
  { id: 'cross',    label: 'Cross-Bill Analysis' },
  { id: 'browse',   label: 'Browse State Bills'  },
]

export default function App() {
  const [activeTab, setActiveTab]         = useState('explain')
  const [bills, setBills]                 = useState({})
  const [selectedBill, setSelectedBill]   = useState('dpdp')
  const [selectedPersona, setSelectedPersona] = useState('')
  const [uploadedBill, setUploadedBill]   = useState(null)
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
      {/* Layered ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[55%] h-[55%]"
             style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 65%)' }} />
        <div className="absolute top-[30%] right-[-10%] w-[50%] h-[60%]"
             style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.05) 0%, transparent 65%)' }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[40%] h-[40%]"
             style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.04) 0%, transparent 65%)' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50"
              style={{ background: 'rgba(7,8,13,0.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Top shimmer line */}
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg,transparent 0%,rgba(245,158,11,0.0) 20%,rgba(245,158,11,0.5) 50%,rgba(99,102,241,0.3) 75%,transparent 100%)' }} />

        <div className="max-w-[1440px] mx-auto px-6 flex items-center h-[60px] gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0 mr-2">
            <div className="relative w-9 h-9 shrink-0">
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-xl animate-pulse"
                   style={{ background: 'rgba(245,158,11,0.15)', animationDuration: '3s' }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-[0.9rem] relative z-10"
                   style={{ background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 55%,#b45309 100%)', color: '#07080d', boxShadow: '0 0 20px rgba(245,158,11,0.35)' }}>
                CS
              </div>
            </div>
            <div>
              <div className="font-display font-bold text-[1.05rem] leading-tight tracking-tight"
                   style={{ background: 'linear-gradient(90deg,#f8fafc 40%,#fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                CivicSync
              </div>
              <div className="text-[0.58rem] tracking-[0.12em] uppercase" style={{ color: '#4a5568' }}>
                AI · Indian Legislation · Plain Language
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex flex-1 h-full overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`relative px-5 h-full text-[0.88rem] font-medium whitespace-nowrap transition-all duration-200 border-none bg-transparent cursor-pointer font-sans
                                  ${activeTab === t.id ? 'text-amber-300' : 'text-ink-2 hover:text-ink-1'}`}>
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t"
                        style={{ background: 'linear-gradient(90deg,#f59e0b,#fbbf24)', boxShadow: '0 0 8px rgba(245,158,11,0.6)' }} />
                )}
              </button>
            ))}
          </nav>

          {/* Status + badges */}
          <div className="flex items-center gap-2.5 shrink-0 ml-auto">
            {backendOk === false && (
              <span className="badge badge-err text-[0.62rem]">Backend offline</span>
            )}
            {backendOk === true && (
              <span className="badge badge-ok text-[0.62rem] animate-pulse" style={{ animationDuration: '3s' }}>● Live</span>
            )}
            <span className="badge badge-central">Track 4</span>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[0.68rem] text-ink-3">IIT Madras</span>
              <span className="text-[0.58rem]" style={{ color: '#2d3748' }}>Hackathon 2025</span>
            </div>
          </div>
        </div>

        {/* Bottom gradient separator */}
        <div className="h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.12) 30%,rgba(99,102,241,0.1) 70%,transparent)' }} />
      </header>

      {/* Content */}
      <main className="max-w-[1440px] mx-auto px-6 py-6 flex-1 w-full relative z-10">
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
      <footer className="relative z-10 py-3 px-6 mt-6"
              style={{ background: 'rgba(245,158,11,0.05)', borderTop: '1px solid rgba(245,158,11,0.12)' }}>
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-center gap-2.5">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="#d97706" strokeWidth="1.5">
            <circle cx="7" cy="7" r="6"/><path d="M7 4.5v2.5M7 8.8v.5" strokeLinecap="round"/>
          </svg>
          <span className="text-[0.76rem] font-semibold" style={{ color: '#92400e' }}>Legal Disclaimer:</span>
          <span className="text-[0.76rem]" style={{ color: '#a16207' }}>
            CivicSync provides information only — not legal advice. For decisions affecting your rights, consult a qualified lawyer.
          </span>
          <span style={{ color: 'rgba(161,98,7,0.4)', margin: '0 4px' }}>·</span>
          {['iCall 9152987821', 'NALSA 15100', "Women's 181"].map(h => (
            <span key={h} className="text-[0.72rem] px-2 py-0.5 rounded font-mono"
                  style={{ color: '#92400e', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)' }}>
              {h}
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}
