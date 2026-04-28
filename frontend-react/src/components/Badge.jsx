export function Badge({ variant = 'central', children, className = '' }) {
  return (
    <span className={`badge badge-${variant} ${className}`}>{children}</span>
  )
}

export function ConfidenceBadge({ confidence }) {
  const map = { CLEAR: 'clear', LIKELY: 'likely', UNCERTAIN: 'uncertain' }
  return <Badge variant={map[confidence] || 'warn'}>{confidence}</Badge>
}

export function GroundedBadge({ grounded }) {
  return grounded
    ? <Badge variant="ok">✓ Verified</Badge>
    : <Badge variant="warn">⚠ Unverified</Badge>
}

export function ConflictTypeBadge({ type }) {
  const map = {
    direct_contradiction: ['contradiction', '⚡ Direct Contradiction'],
    scope_overlap:        ['overlap',       '◎ Scope Overlap'],
    definitional_conflict:['definitional',  '≈ Definitional Conflict'],
    procedural_gap:       ['procedural',    '⊘ Procedural Gap'],
  }
  const [variant, label] = map[type] || ['warn', type]
  return <Badge variant={variant}>{label}</Badge>
}

export function VerdictBadge({ verdict }) {
  const positive = new Set(['positive','protective','robust','business_friendly','good_news'])
  const negative = new Set(['concern','exclusionary','legally_risky','burdensome','bad_news'])
  const variant = positive.has(verdict) ? 'ok' : negative.has(verdict) ? 'err' : 'warn'
  return <Badge variant={variant}>{verdict?.replace(/_/g, ' ')}</Badge>
}
