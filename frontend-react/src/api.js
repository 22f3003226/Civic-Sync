const BASE = '/api'

async function req(method, path, { params, body, form } = {}) {
  let url = `${BASE}${path}`
  if (params) {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') q.set(k, v)
    })
    const qs = q.toString()
    if (qs) url += '?' + qs
  }

  const init = { method }
  if (form) {
    init.body = form
  } else if (body) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data
}

export const api = {
  health:   () => req('GET', '/health'),
  listBills: () => req('GET', '/bills'),

  summarize: (bill, query, persona) =>
    req('POST', '/summarize', {
      params: { bill, query, persona: persona || undefined },
    }),

  checkRights: (situation, uploadedBillKey) =>
    req('POST', '/rights', { body: { situation, uploaded_bill_key: uploadedBillKey } }),

  detectConflicts: (bill_a, bill_b, topic) =>
    req('POST', '/conflicts', { body: { bill_a, bill_b, topic: topic || '' } }),

  runVerdict: (summary, bill_name) =>
    req('POST', '/verdict', { body: { summary, bill_name } }),

  stateBills: ({ state, yearFrom, yearTo, query, limit = 50, offset = 0 } = {}) =>
    req('GET', '/state-bills', {
      params: { state, year_from: yearFrom, year_to: yearTo, query, limit, offset },
    }),

  uploadPdf: (file) => {
    const form = new FormData()
    form.append('file', file)
    return req('POST', '/upload-pdf', { form })
  },
}
