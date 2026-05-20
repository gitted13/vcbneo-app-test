import { useState, useEffect, useMemo, useRef } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { Select } from '../../components/Input'
import Pagination from '../../components/Pagination'
import { C, radius, shadow } from '../../theme'
import { RESOLUTION_OF, isT1, SWIFT_COLS, CORE_COLS_DI, CORE_COLS_DEN, NAPAS_COLS_DI, NAPAS_COLS_DEN } from '../../data/reconcile'
import { DirectionToggle, SwiftStatusCell, NapasTypeTag, NapasStatusCell, StatusBadge, Dash, LastSyncBanner } from '../../components/ReconShared'
import { api } from '../../api/client'

/* Tính ngày lệch n ngày từ chuỗi dd/mm/yyyy */
function dayOffset(ddmmyyyy, n) {
  const [dd, mm, yyyy] = ddmmyyyy.split('/').map(Number)
  const d = new Date(yyyy, mm - 1, dd + n)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmtAmt = n => n.toLocaleString('vi-VN') + ' ₫'
const sumAmt = arr => arr.reduce((s, r) => s + r.amount, 0)

function ColBadge({ row, cols }) {
  const c = cols?.find(col => col.filterFn(row))
  if (c) return <span style={{ padding:'3px 8px', borderRadius:4, fontSize:11, fontWeight:700, background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>{c.label}</span>
  return <StatusBadge status={row.recon_status} />
}

const getSections = dir => [
  { id: 'swift', label: 'Swift – Core GL',   color:'#1e40af', bg:'#eff6ff', border:'#bfdbfe', totalFn: r => !!r.swift, cols: SWIFT_COLS },
  { id: 'core',  label: 'Core GL tổng hợp', color:'#166534', bg:'#dcfce7', border:'#bbf7d0', totalFn: r => !!r.core,  cols: dir==='Đi' ? CORE_COLS_DI : CORE_COLS_DEN },
  { id: 'napas', label: 'NAPAS – Core GL',   color:'#854d0e', bg:'#fefce8', border:'#fde68a', totalFn: r => !!r.napas, cols: dir==='Đi' ? NAPAS_COLS_DI : NAPAS_COLS_DEN },
]

/* ── Detail tables — one per section view ───────────────────────────────── */
const thD = (ex = {}) => ({
  padding: '6px 10px', fontSize: 11, fontWeight: 700, color: C.textMuted,
  background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`,
  textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', textAlign: 'left', ...ex,
})
const tdD = (bg, ex = {}) => ({ padding: '8px 10px', borderBottom: `1px solid ${C.cardBorder}`, background: bg, ...ex })

/* Swift ↔ Core */
function DetailSwift({ rows, cols }) {
  return (
    <div style={{ overflowX: 'auto', borderTop: `1px solid ${C.cardBorder}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>
          <th style={thD()}>Trace</th>
          <th style={thD()}>Sequence</th>
          <th style={thD()}>Số tiền</th>
          <th style={thD({ background: '#eff6ff' })}>Ngày GD (thực tế)</th>
          <th style={thD({ background: '#eff6ff' })}>Ngày GN (ghi nhận)</th>
          <th style={thD({ background: '#eff6ff' })}>TT Swift</th>
          <th style={thD({ background: '#dcfce7', borderLeft: '2px solid #86efac' })}>Ngày Core</th>
          <th style={thD({ background: '#dcfce7' })}>Loại ghi</th>
          <th style={thD()}>Kết quả</th>
        </tr></thead>
        <tbody>{rows.map((r, i) => {
          const bg  = i % 2 ? C.neutralBg : '#fff'
          const sBg = r.swift ? (bg === '#fff' ? '#f8fbff' : '#f2f8ff') : bg
          const cBg = r.core  ? (bg === '#fff' ? '#f7fdf9' : '#f0fdf4') : bg
          const t1  = isT1(r)
          return (
            <tr key={r.id}>
              <td style={tdD(bg, { fontFamily:'monospace', color:C.primary, fontWeight:600 })}>{r.trace}</td>
              <td style={tdD(bg, { fontFamily:'monospace', color:C.textMuted, fontSize:11 })}>{r.sequence ?? '—'}</td>
              <td style={tdD(bg, { fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' })}>{fmtAmt(r.amount)}</td>
              <td style={tdD(sBg, { color:C.textMuted, whiteSpace:'nowrap' })}>{r.swift?.txnDate ?? '—'}</td>
              <td style={tdD(sBg, { color:C.textMuted, whiteSpace:'nowrap' })}>
                {r.swift?.date ?? '—'}
                {t1 && <span style={{ marginLeft:5, fontSize:9, fontWeight:700, color:'#0891b2', background:'#ecfeff', border:'1px solid #a5f3fc', borderRadius:3, padding:'1px 4px' }}>T+1</span>}
              </td>
              <td style={tdD(sBg)}>{r.swift ? <SwiftStatusCell status={r.swift.status} /> : <Dash />}</td>
              <td style={tdD(cBg, { borderLeft:'2px solid #86efac', color:C.textMuted })}>{r.core?.date ?? '—'}</td>
              <td style={tdD(cBg)}>
                {r.core?.entry
                  ? <span style={{ fontSize:11, fontWeight:700, color: r.core.entry==='Ghi có' ? '#166534' : '#1e40af' }}>{r.core.entry}</span>
                  : <Dash />}
              </td>
              <td style={tdD(bg)}><ColBadge row={r} cols={cols} /></td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

/* NAPAS ↔ Core */
function DetailNapas({ rows, cols }) {
  return (
    <div style={{ overflowX: 'auto', borderTop: `1px solid ${C.cardBorder}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>
          <th style={thD()}>Trace</th>
          <th style={thD()}>Số tiền</th>
          <th style={thD({ background: '#fefce8' })}>Ngày GD</th>
          <th style={thD({ background: '#fefce8' })}>Ngày giờ GD</th>
          <th style={thD({ background: '#fefce8' })}>Loại</th>
          <th style={thD({ background: '#fefce8' })}>TC/KTC</th>
          <th style={thD({ background: '#dcfce7', borderLeft: '2px solid #86efac' })}>Ngày Core</th>
          <th style={thD({ background: '#dcfce7' })}>Loại ghi</th>
          <th style={thD()}>Kết quả</th>
        </tr></thead>
        <tbody>{rows.map((r, i) => {
          const bg  = i % 2 ? C.neutralBg : '#fff'
          const nBg = r.napas ? (bg === '#fff' ? '#fefdf0' : '#fefce8') : bg
          const cBg = r.core  ? (bg === '#fff' ? '#f7fdf9' : '#f0fdf4') : bg
          return (
            <tr key={r.id}>
              <td style={tdD(bg, { fontFamily:'monospace', color:C.primary, fontWeight:600 })}>{r.trace}</td>
              <td style={tdD(bg, { fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' })}>{fmtAmt(r.amount)}</td>
              <td style={tdD(nBg, { color:C.textMuted, whiteSpace:'nowrap' })}>{r.napas?.date ?? '—'}</td>
              <td style={tdD(nBg, { color:'#6b7280', fontSize:11, fontFamily:'monospace', whiteSpace:'nowrap' })}>
                {r.napas?.date && r.napas?.time ? `${r.napas.date} ${r.napas.time}` : '—'}
              </td>
              <td style={tdD(nBg)}>{r.napas ? <NapasTypeTag type={r.napas.type} /> : <Dash />}</td>
              <td style={tdD(nBg)}>{r.napas ? <NapasStatusCell failed={r.napas.failed} /> : <Dash />}</td>
              <td style={tdD(cBg, { borderLeft:'2px solid #86efac', color:C.textMuted })}>{r.core?.date ?? '—'}</td>
              <td style={tdD(cBg)}>
                {r.core?.entry
                  ? <span style={{ fontSize:11, fontWeight:700, color: r.core.entry==='Ghi có' ? '#166534' : '#1e40af' }}>{r.core.entry}</span>
                  : <Dash />}
              </td>
              <td style={tdD(bg)}><ColBadge row={r} cols={cols} /></td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

/* Core ↔ Swift + NAPAS (1v2) */
function DetailCore({ rows, cols }) {
  return (
    <div style={{ overflowX: 'auto', borderTop: `1px solid ${C.cardBorder}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>
          <th style={thD()}>Trace</th>
          <th style={thD()}>Sequence</th>
          <th style={thD()}>Số tiền</th>
          <th style={thD({ background: '#dcfce7' })}>Ngày Core</th>
          <th style={thD({ background: '#dcfce7' })}>Loại ghi</th>
          <th style={thD({ background: '#eff6ff', borderLeft: '2px solid #93c5fd' })}>Ngày GD (thực tế)</th>
          <th style={thD({ background: '#eff6ff' })}>Ngày GN (ghi nhận)</th>
          <th style={thD({ background: '#eff6ff' })}>TT Swift</th>
          <th style={thD({ background: '#fefce8', borderLeft: '2px solid #fcd34d' })}>Ngày GD NAPAS</th>
          <th style={thD({ background: '#fefce8' })}>Ngày giờ GD</th>
          <th style={thD({ background: '#fefce8' })}>Loại</th>
          <th style={thD()}>Kết quả</th>
        </tr></thead>
        <tbody>{rows.map((r, i) => {
          const bg  = i % 2 ? C.neutralBg : '#fff'
          const cBg = r.core  ? (bg === '#fff' ? '#f7fdf9' : '#f0fdf4') : bg
          const sBg = r.swift ? (bg === '#fff' ? '#f8fbff' : '#f2f8ff') : bg
          const nBg = r.napas ? (bg === '#fff' ? '#fefdf0' : '#fefce8') : bg
          const t1  = isT1(r)
          return (
            <tr key={r.id}>
              <td style={tdD(bg, { fontFamily:'monospace', color:C.primary, fontWeight:600 })}>{r.trace}</td>
              <td style={tdD(bg, { fontFamily:'monospace', color:C.textMuted, fontSize:11 })}>{r.sequence ?? '—'}</td>
              <td style={tdD(bg, { fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' })}>{fmtAmt(r.amount)}</td>
              <td style={tdD(cBg, { color:C.textMuted })}>{r.core?.date ?? '—'}</td>
              <td style={tdD(cBg)}>
                {r.core?.entry
                  ? <span style={{ fontSize:11, fontWeight:700, color: r.core.entry==='Ghi có' ? '#166534' : '#1e40af' }}>{r.core.entry}</span>
                  : <Dash />}
              </td>
              <td style={tdD(sBg, { borderLeft:'2px solid #93c5fd', color:C.textMuted, whiteSpace:'nowrap' })}>{r.swift?.txnDate ?? '—'}</td>
              <td style={tdD(sBg, { color:C.textMuted, whiteSpace:'nowrap' })}>
                {r.swift?.date ?? '—'}
                {t1 && <span style={{ marginLeft:5, fontSize:9, fontWeight:700, color:'#0891b2', background:'#ecfeff', border:'1px solid #a5f3fc', borderRadius:3, padding:'1px 4px' }}>T+1</span>}
              </td>
              <td style={tdD(sBg)}>{r.swift ? <SwiftStatusCell status={r.swift.status} /> : <Dash />}</td>
              <td style={tdD(nBg, { borderLeft:'2px solid #fcd34d', color:C.textMuted, whiteSpace:'nowrap' })}>{r.napas?.date ?? '—'}</td>
              <td style={tdD(nBg, { color:'#6b7280', fontSize:11, fontFamily:'monospace', whiteSpace:'nowrap' })}>
                {r.napas?.date && r.napas?.time ? `${r.napas.date} ${r.napas.time}` : '—'}
              </td>
              <td style={tdD(nBg)}>{r.napas ? <NapasTypeTag type={r.napas.type} /> : <Dash />}</td>
              <td style={tdD(bg)}><ColBadge row={r} cols={cols} /></td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

/* All 3 sources (▼ Tất cả) */
function DetailAll({ rows }) {
  return (
    <div style={{ overflowX: 'auto', borderTop: `1px solid ${C.cardBorder}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>
          <th style={thD()}>Trace</th>
          <th style={thD()}>Sequence</th>
          <th style={thD()}>Số tiền</th>
          <th style={thD({ background: '#eff6ff' })}>Ngày GD (thực tế)</th>
          <th style={thD({ background: '#eff6ff' })}>Ngày GN (ghi nhận)</th>
          <th style={thD({ background: '#eff6ff' })}>TT Swift</th>
          <th style={thD({ background: '#fefce8', borderLeft:'2px solid #fcd34d' })}>Ngày GD NAPAS</th>
          <th style={thD({ background: '#fefce8' })}>Ngày giờ GD</th>
          <th style={thD({ background: '#fefce8' })}>Loại</th>
          <th style={thD({ background: '#dcfce7', borderLeft:'2px solid #86efac' })}>Ngày Core</th>
          <th style={thD({ background: '#dcfce7' })}>Loại ghi</th>
          <th style={thD()}>Kết quả</th>
        </tr></thead>
        <tbody>{rows.map((r, i) => {
          const bg  = i % 2 ? C.neutralBg : '#fff'
          const sBg = r.swift ? (bg === '#fff' ? '#f8fbff' : '#f2f8ff') : bg
          const nBg = r.napas ? (bg === '#fff' ? '#fefdf0' : '#fefce8') : bg
          const cBg = r.core  ? (bg === '#fff' ? '#f7fdf9' : '#f0fdf4') : bg
          const t1  = isT1(r)
          return (
            <tr key={r.id}>
              <td style={tdD(bg, { fontFamily:'monospace', color:C.primary, fontWeight:600 })}>{r.trace}</td>
              <td style={tdD(bg, { fontFamily:'monospace', color:C.textMuted, fontSize:11 })}>{r.sequence ?? '—'}</td>
              <td style={tdD(bg, { fontFamily:'monospace', fontWeight:600, whiteSpace:'nowrap' })}>{fmtAmt(r.amount)}</td>
              <td style={tdD(sBg, { color:C.textMuted, whiteSpace:'nowrap' })}>{r.swift?.txnDate ?? '—'}</td>
              <td style={tdD(sBg, { color:C.textMuted, whiteSpace:'nowrap' })}>
                {r.swift?.date ?? '—'}
                {t1 && <span style={{ marginLeft:5, fontSize:9, fontWeight:700, color:'#0891b2', background:'#ecfeff', border:'1px solid #a5f3fc', borderRadius:3, padding:'1px 4px' }}>T+1</span>}
              </td>
              <td style={tdD(sBg)}>{r.swift ? <SwiftStatusCell status={r.swift.status} /> : <Dash />}</td>
              <td style={tdD(nBg, { borderLeft:'2px solid #fcd34d', color:C.textMuted, whiteSpace:'nowrap' })}>{r.napas?.date ?? '—'}</td>
              <td style={tdD(nBg, { color:'#6b7280', fontSize:11, fontFamily:'monospace', whiteSpace:'nowrap' })}>
                {r.napas?.date && r.napas?.time ? `${r.napas.date} ${r.napas.time}` : '—'}
              </td>
              <td style={tdD(nBg)}>{r.napas ? <NapasTypeTag type={r.napas.type} /> : <Dash />}</td>
              <td style={tdD(cBg, { borderLeft:'2px solid #86efac', color:C.textMuted })}>{r.core?.date ?? '—'}</td>
              <td style={tdD(cBg)}>
                {r.core?.entry
                  ? <span style={{ fontSize:11, fontWeight:700, color: r.core.entry==='Ghi có' ? '#166534' : '#1e40af' }}>{r.core.entry}</span>
                  : <Dash />}
              </td>
              <td style={tdD(bg)}><StatusBadge status={r.recon_status} /></td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

/* ── Count cell ───────────────────────────────────────────────────────────── */
function CountCell({ count, col, isActive, onClick }) {
  const style = {
    padding: '9px 6px', textAlign: 'center',
    borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6',
    background: isActive ? col.bg : 'transparent',
  }
  if (!count) return <td style={style}><span style={{ color:'#d1d5db', fontSize:12 }}>—</span></td>
  return (
    <td style={style}>
      <button onClick={onClick} title={col.label}
        style={{
          display:'inline-block', minWidth:26, padding:'2px 7px', borderRadius:99,
          fontSize:12, fontWeight:700, cursor:'pointer',
          border: isActive ? `1.5px solid ${col.border}` : 'none',
          background: col.bg, color: col.color,
        }}>
        {count}
      </button>
    </td>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function MasterSummary() {
  const [dir, setDir]               = useState('Đi')
  const [activeView, setView]       = useState('summary')
  const [visibleSections, setVS]    = useState(new Set(['swift', 'core', 'napas']))
  const [expandKey, setExpandKey]   = useState(null)
  const [allData, setAllData]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [detailPage, setDP]         = useState(1)
  const [detailPageSize, setDPS]    = useState(30)
  const [unmatchedPage, setUP]      = useState(1)
  const [unmatchedPageSize, setUPS] = useState(30)
  const [filterDay, setFD]          = useState('')
  const topScrollRef                = useRef(null)
  const tableScrollRef              = useRef(null)

  useEffect(() => { setDP(1) }, [expandKey])

  useEffect(() => {
    if (loading) return
    const top   = topScrollRef.current
    const table = tableScrollRef.current
    if (!top || !table) return
    const syncTop   = () => { table.scrollLeft = top.scrollLeft }
    const syncTable = () => { top.scrollLeft   = table.scrollLeft }
    top.addEventListener('scroll', syncTop)
    table.addEventListener('scroll', syncTable)
    const ro = new ResizeObserver(() => {
      const inner = top.firstChild
      if (inner) inner.style.width = table.scrollWidth + 'px'
    })
    ro.observe(table)
    return () => {
      top.removeEventListener('scroll', syncTop)
      table.removeEventListener('scroll', syncTable)
      ro.disconnect()
    }
  }, [loading])

  useEffect(() => {
    api.getRows()
      .then(res => setAllData(res.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleSection = id => setVS(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleExpand = key => setExpandKey(prev => prev === key ? null : key)

  const SECTIONS      = getSections(dir)
  const allRows       = allData.filter(r => r.direction === dir)
  const visSections   = SECTIONS.filter(s => visibleSections.has(s.id))
  const totalCols     = 1 + visSections.reduce((n, s) => n + 1 + s.cols.length, 0) + 1
  const unmatchedRows = allRows.filter(r => !['KHOP', 'KHOP_LECH_NGAY'].includes(r.recon_status))
  const needsActRows  = allRows.filter(r => RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by)

  const th = (ex = {}) => ({
    padding: '7px 6px', fontSize: 10, fontWeight: 700, color: C.textMuted,
    background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`,
    textTransform: 'uppercase', letterSpacing: 0.3,
    textAlign: 'center', borderRight: '1px solid #f3f4f6', verticalAlign: 'top', ...ex,
  })

  const DAYS = useMemo(() => {
    const seen = new Set()
    const days = []
    for (const r of allData) {
      if (r.day && !seen.has(r.day)) { seen.add(r.day); days.push(r.day) }
    }
    return days.sort()
  }, [allData])

  const filteredDays   = filterDay ? DAYS.filter(d => d === filterDay) : DAYS
  const pagedUnmatched = unmatchedRows.slice((unmatchedPage - 1) * unmatchedPageSize, unmatchedPage * unmatchedPageSize)
  const pagedNeedsAct  = needsActRows.slice((unmatchedPage - 1) * unmatchedPageSize, unmatchedPage * unmatchedPageSize)

  if (loading) return <PageShell title="Tổng hợp 3 nguồn"><div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Đang tải dữ liệu...</div></PageShell>

  return (
    <PageShell
      title="Tổng hợp 3 nguồn"
      subtitle="Tổng hợp theo ngày — bấm số để xem chi tiết 2 nguồn, bấm ▼ để xem toàn bộ."
    >
      <LastSyncBanner />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <DirectionToggle value={dir} onChange={d => { setDir(d); setExpandKey(null); setFD(''); setView('summary'); setUP(1) }} />
        {activeView === 'summary' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {SECTIONS.map(s => {
              const active = visibleSections.has(s.id)
              return (
                <button key={s.id} onClick={() => toggleSection(s.id)}
                  style={{
                    padding: '5px 14px', borderRadius: 6, fontFamily: 'inherit',
                    border: `1.5px solid ${active ? s.border : C.cardBorder}`,
                    background: active ? s.bg : '#fff', color: active ? s.color : C.textMuted,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s',
                  }}>
                  {s.label}
                </button>
              )
            })}
          </div>
        )}
        {activeView === 'summary' && (
          <Select value={filterDay} onChange={e => { setFD(e.target.value); setExpandKey(null) }} style={{ width: 140 }}>
            <option value="">Tất cả ngày</option>
            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
        )}
      </div>

      {/* View tab switcher */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 16 }}>
        {[
          { key: 'summary',      label: 'Tổng hợp',   count: allRows.length,        color: C.primary,  badgeBg: '#eff6ff' },
          { key: 'unmatched',    label: 'Không khớp', count: unmatchedRows.length,  color: '#dc2626',  badgeBg: '#fef2f2' },
          { key: 'needs_action', label: 'Cần xử lý',  count: needsActRows.length,   color: '#d97706',  badgeBg: '#fffbeb' },
        ].map(t => {
          const active = activeView === t.key
          return (
            <button key={t.key} onClick={() => { setView(t.key); setUP(1) }}
              style={{ padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? t.color : C.textMuted,
                borderBottom: active ? `2.5px solid ${t.color}` : '2.5px solid transparent',
                marginBottom: -1, transition: 'all 0.12s' }}>
              {t.label}
              {t.count > 0 && (
                <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 99, fontSize: 11,
                  fontWeight: 700, background: active ? t.color : t.badgeBg,
                  color: active ? '#fff' : t.color }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Không khớp flat view */}
      {activeView === 'unmatched' && (
        <div style={{ background: '#fff', border: `1px solid #fecaca`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>!</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                {unmatchedRows.length} giao dịch không khớp hoàn toàn — chưa cân bằng giữa 3 nguồn ({dir})
              </div>
              <div style={{ fontSize: 11, color: '#9b1c1c', marginTop: 2 }}>
                Gồm các trạng thái Chỉ Swift, Chỉ NAPAS, Chỉ Core, Timeout, Thất bại và Ngoại lệ. Kiểm tra từng dòng với bộ phận liên quan.
              </div>
            </div>
          </div>
          <DetailAll rows={pagedUnmatched} />
          <Pagination total={unmatchedRows.length} page={unmatchedPage} pageSize={unmatchedPageSize} onPage={setUP} onPageSize={setUPS} />
        </div>
      )}

      {/* Cần xử lý flat view */}
      {activeView === 'needs_action' && (
        <div style={{ background: '#fff', border: `1px solid #fde68a`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, color: '#d97706', fontWeight: 700, flexShrink: 0 }}>!</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>
                {needsActRows.length} giao dịch cần xử lý thủ công ({dir})
              </div>
              <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
                Operator hoặc Admin cần review, xác nhận hủy hoặc liên hệ đối tác tùy từng trường hợp.
              </div>
            </div>
          </div>
          <DetailAll rows={pagedNeedsAct} />
          <Pagination total={needsActRows.length} page={unmatchedPage} pageSize={unmatchedPageSize} onPage={setUP} onPageSize={setUPS} />
        </div>
      )}

      {activeView === 'summary' && <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div ref={topScrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', height: 12, borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
          <div style={{ height: 1 }} />
        </div>
        <div ref={tableScrollRef} style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...th({ textAlign:'left', padding:'8px 12px', minWidth:110 }), borderRight:`2px solid ${C.cardBorder}` }} rowSpan={2}>
                  Ngày GD
                </th>
                {visSections.map(s => (
                  <th key={s.id} colSpan={1 + s.cols.length}
                    style={{ padding:'6px 8px', textAlign:'center', fontSize:11, fontWeight:800,
                      letterSpacing:0.5, background:s.bg, color:s.color,
                      borderBottom:`1px solid ${s.border}`, borderRight:`2px solid ${s.border}` }}>
                    {s.label}
                  </th>
                ))}
                <th style={th()} rowSpan={2} />
              </tr>
              <tr>
                {visSections.map(s => (
                  <>
                    <th key={s.id+'_t'} style={th({ background:s.bg, color:s.color, minWidth:52, fontWeight:800, borderRight:`1px solid ${s.border}` })}>
                      Tổng
                    </th>
                    {s.cols.map((col, ci) => (
                      <th key={s.id+ci} style={th({
                        background:s.bg, color:s.color, minWidth:110, fontWeight:600,
                        borderRight: ci===s.cols.length-1 ? `2px solid ${s.border}` : '1px solid #f3f4f6',
                        lineHeight: 1.4,
                      })}>
                        {col.label}
                      </th>
                    ))}
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDays.map(day => {
                const dayRows      = allRows.filter(r => r.day === day)
                const expanded     = expandKey?.startsWith(day + ':')
                const expandSuffix = expanded ? expandKey.slice(day.length + 1) : null

                /* Parse which section & col were clicked to pick detail view */
                let detailRows  = dayRows
                let detailLabel = ''
                let detailColor = {}
                let detailMode  = 'all'
                if (expandSuffix && expandSuffix !== 'all') {
                  const parts  = expandSuffix.split(':')
                  const secId  = parts[0]
                  const colKey = parts[2]   // 'total' or numeric index
                  const sec    = SECTIONS.find(s => s.id === secId)
                  detailMode   = secId       // 'swift' | 'core' | 'napas'
                  if (colKey === 'total') {
                    detailRows  = dayRows.filter(sec.totalFn)
                    detailLabel = `Tổng ${sec.label}`
                    detailColor = { color:sec.color, background:sec.bg, border:`1px solid ${sec.border}` }
                  } else {
                    const col  = sec?.cols[parseInt(colKey, 10)]
                    if (col) {
                      detailRows  = dayRows.filter(col.filterFn)
                      detailLabel = col.label
                      detailColor = { color:col.color, background:col.bg, border:`1px solid ${col.border}` }
                    }
                  }
                }

                return (
                  <>
                    <tr key={day} style={{ background: expanded ? '#fffdf5' : '#fff' }}>
                      <td style={{ padding:'12px 12px', fontWeight:700, fontSize:13, color:'#111827',
                        borderBottom: expanded ? 'none' : `1px solid ${C.cardBorder}`,
                        borderRight:`2px solid ${C.cardBorder}`, whiteSpace:'nowrap' }}>
                        {day}
                        <div style={{ fontSize:11, fontWeight:400, color:C.textMuted, marginTop:1 }}>
                          {fmtAmt(sumAmt(dayRows))}
                        </div>
                      </td>

                      {visSections.map(s => {
                        const secTotal  = dayRows.filter(s.totalFn).length
                        const totalKey  = `${day}:${s.id}::total`
                        const totActive = expandKey === totalKey
                        return (
                          <>
                            <td key={s.id+'_tot'} style={{
                              padding:'9px 10px', textAlign:'center', fontWeight:700, fontSize:13,
                              borderBottom: expanded ? 'none' : `1px solid ${C.cardBorder}`,
                              borderRight:`1px solid ${s.border}`,
                              background: totActive ? s.bg : 'transparent',
                              color: secTotal ? s.color : '#d1d5db',
                              cursor: secTotal ? 'pointer' : 'default',
                            }}
                              onClick={() => secTotal && toggleExpand(totalKey)}>
                              {secTotal || '—'}
                            </td>
                            {s.cols.map((col, ci) => {
                              const cellKey  = `${day}:${s.id}::${ci}`
                              const isActive = expandKey === cellKey
                              return (
                                <CountCell key={cellKey}
                                  count={dayRows.filter(col.filterFn).length}
                                  col={col} isActive={isActive}
                                  onClick={() => toggleExpand(cellKey)} />
                              )
                            })}
                          </>
                        )
                      })}

                      <td style={{ padding:'10px 8px', textAlign:'center', borderBottom: expanded ? 'none' : `1px solid ${C.cardBorder}` }}>
                        <Button size="sm" variant="ghost" onClick={() => toggleExpand(`${day}:all`)}>
                          {expanded && expandSuffix==='all' ? '▲ Ẩn' : '▼ Tất cả'}
                        </Button>
                      </td>
                    </tr>

                    {expanded && (() => {
                      const pagedDetail = detailRows.slice((detailPage - 1) * detailPageSize, detailPage * detailPageSize)
                      return (
                        <tr key={day+'_det'}>
                          <td colSpan={totalCols} style={{ padding:0, borderBottom:`2px solid ${C.cardBorder}`, background:'#fafafa' }}>
                            <div style={{ padding:'6px 12px 4px', fontSize:11, fontWeight:700, color:C.textMuted,
                              background:'#f3f4f6', borderBottom:`1px solid ${C.cardBorder}`,
                              display:'flex', alignItems:'center', gap:8 }}>
                              Chi tiết {day} — {dir} — {detailRows.length} giao dịch
                              <span style={{ fontSize:10, fontWeight:400, color:'#6b7280' }}>
                                (T-1: {dayOffset(day, -1)} · T: {day} · T+1: {dayOffset(day, 1)})
                              </span>
                              {detailLabel && (
                                <span style={{ padding:'1px 8px', borderRadius:4, fontSize:11, fontWeight:700, ...detailColor }}>
                                  {detailLabel}
                                </span>
                              )}
                              <button onClick={() => setExpandKey(null)}
                                style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:14, color:C.textMuted }}>
                                ✕
                              </button>
                            </div>
                            {detailMode === 'swift' && <DetailSwift rows={pagedDetail} cols={SWIFT_COLS} />}
                            {detailMode === 'napas' && <DetailNapas rows={pagedDetail} cols={dir==='Đi' ? NAPAS_COLS_DI : NAPAS_COLS_DEN} />}
                            {detailMode === 'core'  && <DetailCore  rows={pagedDetail} cols={dir==='Đi' ? CORE_COLS_DI  : CORE_COLS_DEN}  />}
                            {detailMode === 'all'   && <DetailAll   rows={pagedDetail} />}
                            <Pagination total={detailRows.length} page={detailPage} pageSize={detailPageSize} onPage={setDP} onPageSize={setDPS} />
                          </td>
                        </tr>
                      )
                    })()}
                  </>
                )
              })}

              {/* Grand total */}
              <tr style={{ background:'#f8fafc' }}>
                <td style={{ padding:'10px 12px', fontSize:12, fontWeight:700, color:'#374151',
                  borderTop:`2px solid ${C.cardBorder}`, borderRight:`2px solid ${C.cardBorder}` }}>
                  Tổng cộng
                  <div style={{ fontSize:11, fontWeight:400, color:C.textMuted }}>{fmtAmt(sumAmt(allRows))}</div>
                </td>
                {visSections.map(s => (
                  <>
                    <td key={s.id+'_gtot'} style={{
                      padding:'10px 10px', textAlign:'center', fontSize:13, fontWeight:700,
                      borderTop:`2px solid ${C.cardBorder}`, borderRight:`1px solid ${s.border}`,
                      color:s.color, background:s.bg,
                    }}>
                      {allRows.filter(s.totalFn).length}
                    </td>
                    {s.cols.map((col, ci) => {
                      const count = allRows.filter(col.filterFn).length
                      return (
                        <td key={s.id+ci+'_g'} style={{
                          padding:'10px 8px', textAlign:'center', fontSize:12, fontWeight:700,
                          borderTop:`2px solid ${C.cardBorder}`,
                          borderRight: ci===s.cols.length-1 ? `2px solid ${s.border}` : '1px solid #f3f4f6',
                          color: count ? col.color : '#d1d5db',
                        }}>
                          {count || '—'}
                        </td>
                      )
                    })}
                  </>
                ))}
                <td style={{ borderTop:`2px solid ${C.cardBorder}` }} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>}
    </PageShell>
  )
}
