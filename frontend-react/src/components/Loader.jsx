export function Dots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
    </span>
  )
}

export function Spinner({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin shrink-0">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" strokeWidth="3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

export function LoadingCard({ label = 'Thinking…' }) {
  return (
    <div className="card-flat flex items-center gap-3 px-4 py-3">
      <Spinner />
      <span className="text-ink-2 text-sm">{label}</span>
    </div>
  )
}
