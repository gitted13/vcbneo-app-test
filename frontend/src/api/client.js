const BASE = '/api/v1'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(body.detail ?? res.statusText)
  }
  if (res.status === 204) return null
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

  getDbRows: () => request('/reconcile/db-rows'),

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

  // Reconcile config + flex pipeline endpoints
  reconcileConfig: {
    // Join configs (JoinLogic page)
    getJoinConfigs: () => request('/reconcile/join-configs'),
    createJoinConfig: (config, created_by = 'user') =>
      request('/reconcile/join-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, created_by }),
      }),
    updateJoinConfig: (id, config, created_by = 'user') =>
      request(`/reconcile/join-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, created_by }),
      }),
    deleteJoinConfig: (id) =>
      request(`/reconcile/join-configs/${id}`, { method: 'DELETE' }),

    // Status rules (DateRules page)
    getStatusRules: () => request('/reconcile/status-rules'),
    saveStatusRules: (rules, updated_by = 'user') =>
      request('/reconcile/status-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, updated_by }),
      }),

    // Flex reconcile pipeline
    runFlex: (config_id, run_date = null, created_by = 'user') =>
      request('/reconcile/run-flex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_id, run_date, created_by }),
      }),
    getFlexResults: (config_id, run_date = null) => {
      const params = new URLSearchParams({ config_id })
      if (run_date) params.set('run_date', run_date)
      return request(`/reconcile/flex-results?${params}`)
    },
    getFlexSummary: (config_id, run_date = null) => {
      const params = new URLSearchParams({ config_id })
      if (run_date) params.set('run_date', run_date)
      return request(`/reconcile/flex-summary?${params}`)
    },
    getFlexRunDates: (config_id) =>
      request(`/reconcile/flex-run-dates?config_id=${config_id}`),
    patchFlexResult: (result_id, patch) =>
      request(`/reconcile/flex-results/${result_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
  },

  // Flex / dynamic DB endpoints
  flex: {
    getSystems: () => request('/flex/systems'),
    getTypes: (systemCode) => {
      const params = systemCode ? `?system_code=${encodeURIComponent(systemCode)}` : ''
      return request(`/flex/types${params}`)
    },
    getRows: (typeId, { page = 1, pageSize = 50, search = '', dateField = '', dateFrom = '', dateTo = '' } = {}) => {
      const params = new URLSearchParams({ type_id: typeId, page, page_size: pageSize })
      if (search)    params.set('search', search)
      if (dateField) params.set('date_field', dateField)
      if (dateFrom)  params.set('date_from', dateFrom)
      if (dateTo)    params.set('date_to', dateTo)
      return request(`/flex/rows?${params}`)
    },
    getFiles: (typeId, { page = 1, pageSize = 20, search = '', status = '' } = {}) => {
      const params = new URLSearchParams({ page, page_size: pageSize })
      if (typeId != null) params.set('type_id', typeId)
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      return request(`/flex/files?${params}`)
    },
    upload: (typeId, file) => {
      const fd = new FormData()
      fd.append('type_id', typeId)
      fd.append('file', file)
      return request('/flex/upload', { method: 'POST', body: fd })
    },
    patchType: (typeId, patch) =>
      request(`/flex/types/${typeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    createType: (body) =>
      request('/flex/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    scanFile: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return request('/flex/scan-file', { method: 'POST', body: fd })
    },
    purge: (typeId = null) => {
      const params = typeId != null ? `?type_id=${typeId}` : ''
      return request(`/flex/purge${params}`, { method: 'DELETE' })
    },
    deleteFile: (fileId) => request(`/flex/files/${fileId}`, { method: 'DELETE' }),
  },
}
