const BASE = '/api/v1'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? res.statusText)
  }
  return res.json()
}

export const api = {
  getStatus: () => request('/files/status'),

  upload: (slot, file) => {
    const fd = new FormData()
    fd.append('slot', slot)
    fd.append('file', file)
    return request('/files/upload', { method: 'POST', body: fd })
  },

  getDates: () => request('/files/dates'),

  runReconcile: (dateLabels, year) =>
    request('/reconcile/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_labels: dateLabels, year }),
    }),

  getRows: (dateLabels = [], year = new Date().getFullYear()) => {
    const params = new URLSearchParams({ year })
    dateLabels.forEach(d => params.append('date_labels', d))
    return request(`/reconcile/rows?${params}`)
  },

  patchRow: (id, patch) =>
    request(`/reconcile/rows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  exportExcel: (dateLabels, year) => {
    const params = new URLSearchParams({ year })
    dateLabels.forEach(d => params.append('date_labels', d))
    return `${BASE}/report/export/excel?${params}`
  },
}
