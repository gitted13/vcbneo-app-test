import { useState, useEffect, useMemo } from 'react'
import PageShell from '../../components/PageShell'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'

const PALETTE = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#64748b', '#0891b2', '#be185d']
const PAGE_SIZE = 200

// ── Helpers ───────────────────────────────────────────────────────────────────

function colLabel(col) {
  return col.field_name.replace(/_/g, ' ')
}

function isDateType(col) {
  return col.data_type === 'date' || col.data_type === 'datetime'
}

function isNumType(col) {
  return col.data_type === 'number' || col.data_type === 'integer'
}

// "Giờ GD" (giờ_gd) is stored as an HHMMSS integer (e.g. 92425 = 09:24:25),
// not a plain quantity — must not fall into the thousands-grouped number
// formatting below, or it renders as "92.425" instead of a time.
function isTimeField(col) {
  return col.field_name === 'giờ_gd'
}

function formatTime(val) {
  const s = String(val ?? '').trim().padStart(6, '0')
  if (/^\d{6}$/.test(s))
    return `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4, 6)}`
  return s
}

function isStatusCol(col) {
  return Array.isArray(col.allowed_values) && col.allowed_values.length > 0
}

function formatDate(val) {
  const s = String(val ?? '').trim()
  if (s.length === 8 && /^\d{8}$/.test(s))
    return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`
  return s
}

function StatusChip({ value }) {
  const v = String(value ?? '').toUpperCase()
  let bg = C.neutralBg, color = C.textMuted, border = C.cardBorder
  if (v.includes('THANH CONG') || v === 'OK' || v === 'SUCCESS') {
    bg = '#f0fdf4'; color = '#059669'; border = '#bbf7d0'
  } else if (v.includes('THAT BAI') || v === 'ERROR' || v === 'FAIL') {
    bg = '#fef2f2'; color = '#dc2626'; border = '#fecaca'
  } else if (v.includes('TIMEOUT') || v.includes('PENDING')) {
    bg = '#fffbeb'; color = '#d97706'; border = '#fde68a'
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: bg, color, border: `1px solid ${border}`, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

function CellValue({ value, col }) {
  if (value === null || value === undefined || String(value) === '')
    return <span style={{ color: C.textLight }}>—</span>

  if (isStatusCol(col))
    return <StatusChip value={value} />

  if (isDateType(col))
    return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatDate(value)}</span>

  if (isTimeField(col))
    return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatTime(value)}</span>

  if (isNumType(col)) {
    const n = Number(String(value).replace(/,/g, ''))
    if (!isNaN(n))
      return <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{n.toLocaleString('vi-VN')}</span>
  }

  return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(value)}</span>
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DataStorage() {
  const [types, setTypes]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeId, setActiveId]     = useState(null)
  const [rows, setRows]             = useState([])
  const [rowsLoading, setRLoading]  = useState(false)
  const [search, setSearch]         = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [page, setPage]             = useState(1)

  useEffect(() => {
    api.flex.getTypes('reconcile')
      .then(ts => {
        setTypes(ts)
        if (ts.length > 0) setActiveId(ts[0].id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!activeId) return
    setRLoading(true)
    setRows([])
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
    api.flex.getRows(activeId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setRLoading(false))
  }, [activeId])

  const activeType  = types.find(t => t.id === activeId)
  const schema      = activeType?.fields_schema || {}
  const allCols     = (schema.columns || [])
  const displayCols = allCols  // show all cols including fixed_value

  // Detect first date column in active schema
  const dateCol = allCols.find(c => c.data_type === 'date' || c.data_type === 'datetime')

  // Parse heterogeneous date formats to ISO yyyy-mm-dd for range comparison
  function toISO(val) {
    if (val == null) return null
    const s = String(val).trim()
    if (!s) return null
    if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`   // YYYYMMDD
    if (/^\d{4}$/.test(s)) return `2026-${s.slice(0,2)}-${s.slice(2,4)}`               // MMDD
    if (/^\d{3}$/.test(s)) return `2026-0${s.slice(0,1)}-${s.slice(1,3)}`              // MDD
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return `${s.slice(6)}-${s.slice(3,5)}-${s.slice(0,2)}` // dd/mm/yyyy
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)                            // ISO
    return null
  }

  const filtered = useMemo(() => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(row =>
        Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
      )
    }
    if (dateCol && (dateFrom || dateTo)) {
      result = result.filter(row => {
        const iso = toISO(row[dateCol.field_name])
        if (!iso) return true
        if (dateFrom && iso < dateFrom) return false
        if (dateTo   && iso > dateTo)   return false
        return true
      })
    }
    return result
  }, [rows, search, dateFrom, dateTo, dateCol])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (loading) {
    return (
      <PageShell title="Kho dữ liệu" subtitle="Đang tải cấu hình...">
        <div style={{ padding: '60px 0', textAlign: 'center', color: C.textMuted }}>Đang kết nối...</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Kho dữ liệu"
      subtitle="Dữ liệu đã trích xuất theo cấu hình loại file. Cột hiển thị tự động theo schema đã cài đặt."
    >
      {/* ── Type selector cards ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {types.map((t, i) => {
          const color   = PALETTE[i % PALETTE.length]
          const active  = t.id === activeId
          const schema  = t.fields_schema || {}
          const cols    = (schema.columns || []).filter(c => !c.fixed_value)
          return (
            <button
              key={t.id}
              onClick={() => { setActiveId(t.id); setPage(1) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                background: active ? '#fff' : C.neutralBg,
                border: `1px solid ${C.cardBorder}`,
                borderLeft: `4px solid ${color}`,
                borderRadius: radius.lg,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? shadow.md : 'none',
                outline: active ? `2px solid ${color}` : 'none',
                outlineOffset: -1,
                transition: 'all 0.13s',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? color : C.text }}>{t.upload_name}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{cols.length} cột từ file</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Data panel ── */}
      {activeType && (
        <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>

          {/* Header bar */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: PALETTE[types.indexOf(activeType) % PALETTE.length] }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{activeType.upload_name}</span>
                {schema.description && <span style={{ fontSize: 12, color: C.textMuted }}>— {schema.description}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                {rowsLoading ? 'Đang tải...' : `${rows.length.toLocaleString()} bản ghi · ${displayCols.length} cột`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <ColPillList cols={displayCols} />
            </div>
          </div>

          {/* Search + filter */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              placeholder="Tìm kiếm trong tất cả cột..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={{ flex: 1, minWidth: 160 }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 13 }}>✕</button>
            )}
            {dateCol && (
              <>
                <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap' }}>
                  {colLabel(dateCol)}:
                </span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                  style={{ width: 130 }}
                  title="Từ ngày"
                />
                <span style={{ fontSize: 11, color: C.textMuted }}>—</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1) }}
                  style={{ width: 130 }}
                  title="Đến ngày"
                />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 13 }}
                    title="Xóa bộ lọc ngày">✕</button>
                )}
              </>
            )}
            <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>
              {filtered.length !== rows.length ? `${filtered.length} / ${rows.length}` : rows.length.toLocaleString()} dòng
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            {rowsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: C.textMuted }}>Đang tải dữ liệu...</div>
            ) : displayCols.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: C.textMuted }}>
                Loại file này chưa có cột nào được cấu hình. Vào <b>Cấu hình loại file</b> để thêm cột.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.neutralBg }}>
                    <th style={TH}>#</th>
                    {displayCols.map(col => (
                      <th key={col.field_name} style={TH}>{colLabel(col)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={displayCols.length + 1} style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>
                        {search ? 'Không tìm thấy bản ghi phù hợp' : 'Chưa có dữ liệu — hãy upload file trước'}
                      </td>
                    </tr>
                  ) : pageRows.map((row, i) => (
                    <tr key={row._id ?? i} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 ? C.neutralBg : '#fff' }}>
                      <td style={{ padding: '7px 12px', color: C.textLight, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </td>
                      {displayCols.map(col => (
                        <td key={col.field_name} style={{ padding: '7px 14px', whiteSpace: 'nowrap' }}>
                          <CellValue value={row[col.field_name]} col={col} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={pageBtnStyle(page === 1)}>← Trước</button>
              <span style={{ fontSize: 12, color: C.textMuted }}>
                Trang <b>{page}</b> / {totalPages} ({filtered.length.toLocaleString()} dòng)
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={pageBtnStyle(page === totalPages)}>Sau →</button>
            </div>
          )}

          {/* Footer */}
          {!rowsLoading && (
            <div style={{ padding: '8px 16px', fontSize: 11, color: C.textLight, borderTop: `1px solid ${C.cardBorder}` }}>
              Hiển thị {pageRows.length} / {filtered.length} dòng · mỗi trang {PAGE_SIZE} · type_id={activeId}
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const TH = {
  padding: '8px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 700, color: C.textMuted,
  borderBottom: `1px solid ${C.cardBorder}`,
  textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap',
}

function pageBtnStyle(disabled) {
  return {
    padding: '4px 12px', fontSize: 12, border: `1px solid ${C.cardBorder}`,
    borderRadius: 4, background: disabled ? C.neutralBg : '#fff',
    color: disabled ? C.textLight : C.text, cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }
}

function ColPillList({ cols }) {
  const fileCols  = cols.filter(c => !c.fixed_value)
  const fixedCols = cols.filter(c =>  c.fixed_value)
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {fileCols.length > 0 && (
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
          {fileCols.length} cột file
        </span>
      )}
      {fixedCols.length > 0 && (
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
          {fixedCols.length} tự điền
        </span>
      )}
    </div>
  )
}
