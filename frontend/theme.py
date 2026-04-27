"""
shadcn/ui-inspired CSS for Streamlit.
Inject with: st.markdown(SHADCN_CSS, unsafe_allow_html=True)
"""

SHADCN_CSS = """
<style>
/* ── Google Font: Inter ────────────────────────────────────────────────── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* ── Root tokens (shadcn zinc theme) ──────────────────────────────────── */
:root {
  --background:     #ffffff;
  --foreground:     #09090b;
  --card:           #ffffff;
  --card-border:    #e4e4e7;
  --muted:          #f4f4f5;
  --muted-fg:       #71717a;
  --accent:         #18181b;
  --accent-fg:      #fafafa;
  --primary:        #18181b;
  --primary-fg:     #fafafa;
  --destructive:    #dc2626;
  --warning:        #d97706;
  --success:        #16a34a;
  --border:         #e4e4e7;
  --radius:         0.5rem;
  --shadow-sm:      0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow:         0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md:      0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
}

/* ── Base ─────────────────────────────────────────────────────────────── */
html, body, [data-testid="stAppViewContainer"] {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  background-color: #fafafa !important;
  color: var(--foreground) !important;
}

[data-testid="stMain"] {
  background-color: #fafafa !important;
}

/* ── Hide Streamlit chrome ────────────────────────────────────────────── */
#MainMenu, footer, header { visibility: hidden; }
[data-testid="stDecoration"] { display: none; }

/* ── Sidebar ──────────────────────────────────────────────────────────── */
[data-testid="stSidebar"] {
  background-color: var(--card) !important;
  border-right: 1px solid var(--card-border) !important;
}
[data-testid="stSidebar"] .stSelectbox label,
[data-testid="stSidebar"] .stRadio label,
[data-testid="stSidebar"] p {
  font-size: 0.8125rem !important;
  color: var(--muted-fg) !important;
  font-weight: 500 !important;
  letter-spacing: 0.01em;
}
[data-testid="stSidebar"] h2 {
  font-size: 0.875rem !important;
  font-weight: 600 !important;
  color: var(--foreground) !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Select boxes ─────────────────────────────────────────────────────── */
[data-testid="stSelectbox"] > div > div {
  background: var(--card) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  box-shadow: var(--shadow-sm) !important;
  font-size: 0.875rem !important;
}
[data-testid="stSelectbox"] > div > div:hover {
  border-color: #a1a1aa !important;
}

/* ── Text inputs ──────────────────────────────────────────────────────── */
[data-testid="stTextInput"] input,
[data-testid="stTextArea"] textarea,
[data-testid="stNumberInput"] input {
  background: var(--card) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  box-shadow: var(--shadow-sm) !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 0.875rem !important;
  color: var(--foreground) !important;
  padding: 0.5rem 0.75rem !important;
  transition: border-color 0.15s ease !important;
}
[data-testid="stTextInput"] input:focus,
[data-testid="stTextArea"] textarea:focus {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 2px rgb(24 24 27 / 0.1) !important;
  outline: none !important;
}

/* ── Buttons ──────────────────────────────────────────────────────────── */
[data-testid="stButton"] button[kind="primary"] {
  background-color: var(--primary) !important;
  color: var(--primary-fg) !important;
  border: 1px solid var(--primary) !important;
  border-radius: var(--radius) !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  padding: 0.5rem 1rem !important;
  box-shadow: var(--shadow-sm) !important;
  transition: opacity 0.15s ease !important;
  letter-spacing: 0.01em;
}
[data-testid="stButton"] button[kind="primary"]:hover {
  opacity: 0.88 !important;
}
[data-testid="stButton"] button[kind="secondary"],
[data-testid="stButton"] button:not([kind]) {
  background-color: var(--card) !important;
  color: var(--foreground) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  font-family: 'Inter', sans-serif !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  padding: 0.5rem 1rem !important;
  box-shadow: var(--shadow-sm) !important;
  transition: background-color 0.15s ease !important;
}
[data-testid="stButton"] button[kind="secondary"]:hover,
[data-testid="stButton"] button:not([kind]):hover {
  background-color: var(--muted) !important;
}

/* ── Metric cards ─────────────────────────────────────────────────────── */
[data-testid="stMetric"] {
  background: var(--card) !important;
  border: 1px solid var(--card-border) !important;
  border-radius: var(--radius) !important;
  padding: 1rem 1.25rem !important;
  box-shadow: var(--shadow-sm) !important;
}
[data-testid="stMetricLabel"] {
  font-size: 0.75rem !important;
  font-weight: 500 !important;
  color: var(--muted-fg) !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
[data-testid="stMetricValue"] {
  font-size: 1.5rem !important;
  font-weight: 700 !important;
  color: var(--foreground) !important;
}

/* ── Expanders (shadcn Accordion style) ───────────────────────────────── */
[data-testid="stExpander"] {
  background: var(--card) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  box-shadow: var(--shadow-sm) !important;
  margin-bottom: 0.5rem !important;
  overflow: hidden;
}
[data-testid="stExpander"] summary {
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  color: var(--foreground) !important;
  padding: 0.875rem 1rem !important;
  background: var(--card) !important;
}
[data-testid="stExpander"] summary:hover {
  background: var(--muted) !important;
}
[data-testid="stExpander"] > div > div {
  padding: 0 1rem 1rem !important;
}

/* ── Info / warning / error boxes ────────────────────────────────────── */
[data-testid="stInfo"] {
  background: #eff6ff !important;
  border: 1px solid #bfdbfe !important;
  border-radius: var(--radius) !important;
  color: #1e40af !important;
  font-size: 0.875rem !important;
}
[data-testid="stWarning"] {
  background: #fffbeb !important;
  border: 1px solid #fde68a !important;
  border-radius: var(--radius) !important;
  color: #92400e !important;
  font-size: 0.875rem !important;
}
[data-testid="stError"] {
  background: #fef2f2 !important;
  border: 1px solid #fecaca !important;
  border-radius: var(--radius) !important;
  color: #991b1b !important;
  font-size: 0.875rem !important;
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */
[data-testid="stTabs"] [role="tablist"] {
  border-bottom: 1px solid var(--border) !important;
  gap: 0 !important;
}
[data-testid="stTabs"] [role="tab"] {
  font-family: 'Inter', sans-serif !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  color: var(--muted-fg) !important;
  padding: 0.625rem 1rem !important;
  border: none !important;
  border-bottom: 2px solid transparent !important;
  background: transparent !important;
  border-radius: 0 !important;
  transition: color 0.15s ease !important;
}
[data-testid="stTabs"] [role="tab"][aria-selected="true"] {
  color: var(--foreground) !important;
  border-bottom-color: var(--primary) !important;
  background: transparent !important;
}
[data-testid="stTabs"] [role="tab"]:hover {
  color: var(--foreground) !important;
}

/* ── Dataframe ────────────────────────────────────────────────────────── */
[data-testid="stDataFrame"] {
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  overflow: hidden !important;
  box-shadow: var(--shadow-sm) !important;
}

/* ── Divider ──────────────────────────────────────────────────────────── */
hr {
  border-color: var(--border) !important;
  margin: 1.25rem 0 !important;
}

/* ── Caption / small text ─────────────────────────────────────────────── */
[data-testid="stCaptionContainer"],
small, .caption {
  font-size: 0.75rem !important;
  color: var(--muted-fg) !important;
}

/* ── Progress bar ─────────────────────────────────────────────────────── */
[data-testid="stProgress"] > div > div {
  background-color: var(--primary) !important;
  border-radius: 9999px !important;
}
[data-testid="stProgress"] > div {
  background-color: var(--muted) !important;
  border-radius: 9999px !important;
}

/* ── Radio buttons ────────────────────────────────────────────────────── */
[data-testid="stRadio"] label {
  font-size: 0.875rem !important;
}

/* ── Download button ──────────────────────────────────────────────────── */
[data-testid="stDownloadButton"] button {
  background: var(--card) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  color: var(--foreground) !important;
  box-shadow: var(--shadow-sm) !important;
}

/* ── Page heading ─────────────────────────────────────────────────────── */
h1 {
  font-size: 1.5rem !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
  color: var(--foreground) !important;
}
h2 { font-size: 1.25rem !important; font-weight: 600 !important; }
h3 { font-size: 1rem !important; font-weight: 600 !important; }

/* ── shadcn Card utility (used in HTML blocks) ────────────────────────── */
.sh-card {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 1.25rem 1.5rem;
  margin-bottom: 0.75rem;
}
.sh-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.125rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.5;
}
.sh-badge-green  { background:#dcfce7; color:#15803d; }
.sh-badge-amber  { background:#fef9c3; color:#a16207; }
.sh-badge-red    { background:#fee2e2; color:#b91c1c; }
.sh-badge-zinc   { background:#f4f4f5; color:#52525b; }
</style>
"""


def notice_html(text: str, kind: str = "info") -> str:
    """Return a styled HTML notice block (info | warning | error | success)."""
    colours = {
        "info":    ("#eff6ff", "#1d4ed8", "#bfdbfe"),
        "warning": ("#fffbeb", "#b45309", "#fde68a"),
        "error":   ("#fef2f2", "#b91c1c", "#fecaca"),
        "success": ("#f0fdf4", "#15803d", "#bbf7d0"),
    }
    bg, fg, border = colours.get(kind, colours["info"])
    return (
        f'<div style="background:{bg};color:{fg};border:1px solid {border};'
        f'border-radius:0.5rem;padding:0.875rem 1rem;font-size:0.875rem;'
        f'font-family:Inter,sans-serif;margin:0.5rem 0;">{text}</div>'
    )


def badge_html(text: str, kind: str = "zinc") -> str:
    return f'<span class="sh-badge sh-badge-{kind}">{text}</span>'


def verdict_card_html(icon: str, label: str, headline: str,
                      bg: str, fg: str) -> str:
    return (
        f'<div class="sh-card" style="border-left:4px solid {fg};">'
        f'<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">'
        f'<span style="font-size:1.1rem;">{icon}</span>'
        f'<span style="font-weight:600;font-size:0.875rem;color:{fg};">{label}</span>'
        f'</div>'
        f'<p style="margin:0;font-size:0.875rem;color:#18181b;">{headline}</p>'
        f'</div>'
    )
