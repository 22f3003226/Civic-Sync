export default function SourceQuote({ children }) {
  if (!children) return null
  return <blockquote className="source-quote">{children}</blockquote>
}
