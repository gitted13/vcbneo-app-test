import { useState, useEffect } from 'react'
import PageShell from '../../components/PageShell'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import Pagination from '../../components/Pagination'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'

const PALETTE = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#64748b', '#0891b2', '#be185d']

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

// "Giờ GD" (giờ_gd, NAPAS) and "PCTIME" (Swift đi/đến) are both stored as
// HHMMSS integers/strings (e.g. 92425 = 09:24:25), not plain quantities or
// real dates — must not fall into thousands-grouped number formatting or
// the date formatter below, or they render as "92.425" / raw digits.
const TIME_FIELDS = ['giờ_gd', 'pctime']
function isTimeField(col) {
  return TIME_FIELDS.includes(col.field_name)
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

// Parses every raw date shape actually seen across the 6 file types into
// {y, mo, d, h?, mi?, se?}. NAPAS ships "Ngày GD" as MMDD/MDD with no year
// (e.g. "0203") — assumed to be the current year, same convention already
// used by the date-range filter below.
function parseFlexDate(val) {
  const s = String(val ?? '').trim()
  if (!s) return null
  let m
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)))
    return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], se: +m[6] }
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/)))
    return { y: +m[1], mo: +m[2], d: +m[3] }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)))
    return { y: +m[1], mo: +m[2], d: +m[3] }
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)))
    return { y: +m[3], mo: +m[2], d: +m[1] }
  if (/^\d{3,4}$/.test(s)) {
    const padded = s.padStart(4, '0')
    return { y: new Date().getFullYear(), mo: +padded.slice(0, 2), d: +padded.slice(2, 4) }
  }
  return null
}

function formatDate(val) {
  const p = parseFlexDate(val)
  if (!p) return String(val ?? '')
  const dd = String(p.d).padStart(2, '0'), mm = String(p.mo).padStart(2, '0')
  let out = `${dd}/${mm}/${p.y}`
  if (p.h != null) out += ` ${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}:${String(p.se).padStart(2, '0')}`
  return out
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

  // Checked before isDateType: some columns are schema'd "date"/"datetime"
  // but actually hold a time-of-day value (e.g. Swift's pctime) — must win
  // the dispatch or they'd be parsed as dates and shown raw/wrong.
  if (isTimeField(col))
    return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatTime(value)}</span>

  if (isDateType(col))
    return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatDate(value)}</span>

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
  const [rows, setRows]             = useState([])       // current page only — server-side paginated
  const [rowsTotal, setRowsTotal]   = useState(0)         // matches current search/date filter
  const [rawTotal, setRawTotal]     = useState(0)         // unfiltered total for this type
  const [rowsLoading, setRLoading]  = useState(false)
  const [search, setSearch]         = useState('')         // controlled input value (instant)
  const [debouncedSearch, setDSearch] = useState('')        // what's actually sent to the server
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(50)

  useEffect(() => {
    api.flex.getTypes('reconcile')
      .then(ts => {
        setTypes(ts)
        if (ts.length > 0) setActiveId(ts[0].id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Debounce search: only hit the server 350ms after the user stops typing,
  // so the "instant filter" feel is kept without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setDSearch(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setSearch('')
    setDSearch('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }, [activeId])

  const activeType  = types.find(t => t.id === activeId)
  const schema      = activeType?.fields_schema || {}
  const allCols     = (schema.columns || [])
  const displayCols = allCols  // show all cols including fixed_value

  // Detect first real date column in active schema (excluding columns that
  // are schema'd "date" but actually hold a time value, e.g. pctime).
  const dateCol = allCols.find(c => isDateType(c) && !isTimeField(c))

  // Server does the actual search/date filtering + pagination now — the
  // table only ever holds one page's worth of rows in memory/DOM, no matter
  // how large the underlying file type's dataset grows.
  useEffect(() => {
    if (!activeId) return
    setRLoading(true)
    api.flex.getRows(activeId, {
      page, pageSize,
      search: debouncedSearch,
      dateField: dateCol?.field_name || '',
      dateFrom, dateTo,
    })
      .then(res => { setRows(res.rows); setRowsTotal(res.total); setRawTotal(res.raw_total) })
      .catch(() => { setRows([]); setRowsTotal(0); setRawTotal(0) })
      .finally(() => setRLoading(false))
  }, [activeId, page, pageSize, debouncedSearch, dateFrom, dateTo, dateCol?.field_name])

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
                {rowsLoading ? 'Đang tải...' : `${rawTotal.toLocaleString()} bản ghi · ${displayCols.length} cột`}
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
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setDSearch(''); setPage(1) }}
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
              {rowsTotal !== rawTotal ? `${rowsTotal.toLocaleString()} / ${rawTotal.toLocaleString()}` : rowsTotal.toLocaleString()} dòng
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
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={displayCols.length + 1} style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>
                        {search ? 'Không tìm thấy bản ghi phù hợp' : 'Chưa có dữ liệu — hãy upload file trước'}
                      </td>
                    </tr>
                  ) : rows.map((row, i) => (
                    <tr key={row._id ?? i} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 ? C.neutralBg : '#fff' }}>
                      <td style={{ padding: '7px 12px', color: C.textLight, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {(page - 1) * pageSize + i + 1}
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
          {!rowsLoading && (
            <Pagination
              total={rowsTotal}
              page={page}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
              itemLabel="dòng"
            />
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
