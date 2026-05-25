import { useState, useEffect, useMemo, useRef } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { Input } from '../../components/Input'
import Pagination from '../../components/Pagination'
import { C, radius, shadow } from '../../theme'
import { isT1, SWIFT_COLS_DI, SWIFT_COLS_DEN, CORE_COLS_DI, CORE_COLS_DEN, NAPAS_COLS_DI, NAPAS_COLS_DEN } from '../../data/reconcile'
import { DirectionToggle, SwiftStatusCell, NapasTypeTag, NapasStatusCell, StatusBadge, Dash, LastSyncBanner } from '../../components/ReconShared'
import { api } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { downloadMasterXlsx, downloadTemplateXlsx } from '../../utils/export'

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
  { id: 'swift', label: 'Swift – Core GL',   color:'#1e40af', bg:'#eff6ff', border:'#bfdbfe', totalFn: r => !!r.swift, cols: dir==='Đi' ? SWIFT_COLS_DI : SWIFT_COLS_DEN },
  { id: 'core',  label: 'Core GL tổng hợp', color:'#166534', bg:'#dcfce7', border:'#bbf7d0', totalFn: r => !!r.core,  cols: dir==='Đi' ? CORE_COLS_DI  : CORE_COLS_DEN  },
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

/* ── Count pair: 2 <td> – count button + full amount ─────────────────────── */
function CountPair({ count, amt, col, isActive, onClick, borderRight = '1px solid #f3f4f6', expanded }) {
  const base = { borderBottom: expanded ? 'none' : '1px solid #f3f4f6', verticalAlign: 'middle' }
  if (!count) return (
    <>
      <td style={{ ...base, padding:'7px 6px', textAlign:'center', borderRight }}>
        <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>
      </td>
      <td style={{ ...base, padding:'7px 8px', textAlign:'right', borderRight }} />
    </>
  )

  /* Default: neutral. Expanded hoặc active: dùng màu col */
  const showColor = expanded || isActive
  const btnBg     = showColor ? col.bg    : '#f3f4f6'
  const btnColor  = showColor ? col.color : '#6b7280'
  const btnBorder = isActive  ? `1.5px solid ${col.border}`
                  : showColor ? `1px solid ${col.border}88`
                  : '1px solid #e5e7eb'
  const cellBg    = isActive ? col.bg : 'transparent'
  const amtColor  = showColor ? col.color : '#9ca3af'

  return (
    <>
      <td style={{ ...base, padding:'7px 6px', textAlign:'center', background: cellBg, borderRight }}>
        <button onClick={onClick} title={col.label}
          style={{
            padding:'3px 7px', borderRadius:6,
            fontSize:12, fontWeight:700, cursor:'pointer',
            border: btnBorder, background: btnBg, color: btnColor,
          }}>
          {count}
        </button>
      </td>
      <td style={{ ...base, padding:'7px 8px', textAlign:'right', fontFamily:'monospace', fontSize:11, color: amtColor, background: cellBg, borderRight }}>
        {amt > 0 ? amt.toLocaleString('vi-VN') : ''}
      </td>
    </>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function MasterSummary() {
  const { filterFrom, setFilterFrom: setFrom, filterTo, setFilterTo: setTo } = useApp()
  const [dir, setDir]               = useState('Đi')
  const [visibleSections, setVS]    = useState(new Set(['swift', 'core', 'napas']))
  const [expandKey, setExpandKey]   = useState(null)
  const [allData, setAllData]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [detailPage, setDP]         = useState(1)
  const [detailPageSize, setDPS]    = useState(30)
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
    api.getDbRows()
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

  const SECTIONS    = getSections(dir)
  const allRows     = allData.filter(r => r.direction === dir)
  const visSections = SECTIONS.filter(s => visibleSections.has(s.id))
  const totalCols   = 1 + visSections.reduce((n, s) => n + 2 + 2 * s.cols.length, 0) + 1

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

  const dayToISO = s => { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}` }
  const filteredDays = DAYS.filter(d => {
    const iso = dayToISO(d)
    if (filterFrom && iso < filterFrom) return false
    if (filterTo   && iso > filterTo)   return false
    return true
  })
  const filteredDaySet = new Set(filteredDays)
  const filteredRows   = allRows.filter(r => filteredDaySet.has(r.day))

  const handleExport = async () => {
    await downloadTemplateXlsx({ filteredDays, allRows, filterFrom, filterTo, sumAmt, isT1fn: isT1 })
  }

  if (loading) return <PageShell title="Tổng hợp 3 nguồn"><div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Đang tải dữ liệu...</div></PageShell>

  return (
    <PageShell
      title="Tổng hợp 3 nguồn"
      subtitle="Tổng hợp theo ngày — bấm số để xem chi tiết 2 nguồn, bấm ▼ để xem toàn bộ."
    >
      <LastSyncBanner />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <DirectionToggle value={dir} onChange={d => { setDir(d); setExpandKey(null); setFrom(''); setTo('') }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Input type="date" value={filterFrom} onChange={e => { setFrom(e.target.value); setExpandKey(null) }} style={{ width: 150 }} />
          <span style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>–</span>
          <Input type="date" value={filterTo} onChange={e => { setTo(e.target.value); setExpandKey(null) }} style={{ width: 150 }} />
        </div>
        <Button size="sm" variant="subtle" onClick={handleExport}>↓ Xuất Excel</Button>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div ref={topScrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', height: 12, borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
          <div style={{ height: 1 }} />
        </div>
        <div ref={tableScrollRef} style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              {/* Row 1: Ngày GD + section group headers */}
              <tr>
                <th style={{ ...th({ textAlign:'left', padding:'8px 12px', minWidth:110 }), borderRight:`2px solid ${C.cardBorder}` }} rowSpan={3}>
                  Ngày GD
                </th>
                {visSections.map(s => (
                  <th key={s.id} colSpan={2 + 2 * s.cols.length}
                    style={{ padding:'6px 8px', textAlign:'center', fontSize:11, fontWeight:800,
                      letterSpacing:0.5, background:s.bg, color:s.color,
                      borderBottom:`1px solid ${s.border}`, borderRight:`2px solid ${s.border}` }}>
                    {s.label}
                  </th>
                ))}
                <th style={th()} rowSpan={3} />
              </tr>
              {/* Row 2: Tổng + col group labels */}
              <tr>
                {visSections.map(s => (
                  <>
                    <th key={s.id+'_t'} colSpan={2} style={th({ background:s.bg, color:s.color, fontWeight:800, borderRight:`1px solid ${s.border}` })}>
                      Tổng
                    </th>
                    {s.cols.map((col, ci) => (
                      <th key={s.id+ci} colSpan={2} style={th({
                        background: col.bg, color: col.color, fontWeight:600,
                        borderRight: ci===s.cols.length-1 ? `2px solid ${s.border}` : '1px solid #f3f4f6',
                        lineHeight: 1.4,
                      })}>
                        {col.label}
                      </th>
                    ))}
                  </>
                ))}
              </tr>
              {/* Row 3: Số GD / Số tiền leaf columns */}
              <tr>
                {visSections.map(s => (
                  <>
                    <th key={s.id+'_tgd'} style={th({ background:s.bg, color:s.color, minWidth:44, fontSize:9 })}>Số GD</th>
                    <th key={s.id+'_tamt'} style={th({ background:s.bg, color:s.color, minWidth:120, fontSize:9, borderRight:`1px solid ${s.border}` })}>Số tiền (VNĐ)</th>
                    {s.cols.map((col, ci) => (
                      <>
                        <th key={s.id+ci+'_gd'} style={th({ background:col.bg, color:col.color, minWidth:44, fontSize:9 })}>Số GD</th>
                        <th key={s.id+ci+'_amt'} style={th({
                          background:col.bg, color:col.color, minWidth:120, fontSize:9,
                          borderRight: ci===s.cols.length-1 ? `2px solid ${s.border}` : '1px solid #f3f4f6',
                        })}>Số tiền (VNĐ)</th>
                      </>
                    ))}
                  </>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDays.map((day, dayIdx) => {
                const dayRows      = allRows.filter(r => r.day === day)
                const expanded     = expandKey?.startsWith(day + ':')
                const expandSuffix = expanded ? expandKey.slice(day.length + 1) : null

                let detailRows  = dayRows
                let detailLabel = ''
                let detailColor = {}
                let detailMode  = 'all'
                if (expandSuffix && expandSuffix !== 'all') {
                  const parts  = expandSuffix.split(':')
                  const secId  = parts[0]
                  const colKey = parts[2]
                  const sec    = SECTIONS.find(s => s.id === secId)
                  detailMode   = secId
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

                const rowBg = expanded ? '#eff6ff' : (dayIdx % 2 ? '#f9fafb' : '#fff')

                return (
                  <>
                    <tr key={day} style={{ background: rowBg }}>
                      <td style={{ padding:'12px 12px', fontWeight:700, fontSize:13, color:'#111827',
                        borderBottom: expanded ? 'none' : `1px solid ${C.cardBorder}`,
                        borderRight:`2px solid ${C.cardBorder}`, whiteSpace:'nowrap',
                        background: expanded ? '#dbeafe' : rowBg }}>
                        {day}
                        <div style={{ fontSize:11, fontWeight:400, color:C.textMuted, marginTop:1 }}>
                          {fmtAmt(sumAmt(dayRows))}
                        </div>
                      </td>

                      {visSections.map(s => {
                        const secRows   = dayRows.filter(s.totalFn)
                        const secTotal  = secRows.length
                        const secAmt    = sumAmt(secRows)
                        const totalKey  = `${day}:${s.id}::total`
                        const totActive = expandKey === totalKey
                        return (
                          <>
                            <td key={s.id+'_cnt'} style={{
                              padding:'7px 6px', textAlign:'center', fontWeight:700, fontSize:13,
                              borderBottom: expanded ? 'none' : `1px solid ${C.cardBorder}`,
                              borderRight:`1px solid ${s.border}`,
                              background: totActive ? s.bg : 'transparent',
                              color: secTotal ? (totActive || expanded ? s.color : '#6b7280') : '#d1d5db',
                              cursor: secTotal ? 'pointer' : 'default',
                            }}
                              onClick={() => secTotal && toggleExpand(totalKey)}>
                              {secTotal || '—'}
                            </td>
                            <td key={s.id+'_tamt'} style={{
                              padding:'7px 8px', textAlign:'right', fontFamily:'monospace', fontSize:11,
                              borderBottom: expanded ? 'none' : `1px solid ${C.cardBorder}`,
                              borderRight:`1px solid ${s.border}`,
                              background: totActive ? s.bg : 'transparent',
                              color: secTotal ? (totActive || expanded ? s.color : '#9ca3af') : '#d1d5db',
                            }}>
                              {secAmt > 0 ? secAmt.toLocaleString('vi-VN') : ''}
                            </td>
                            {s.cols.map((col, ci) => {
                              const colRows  = dayRows.filter(col.filterFn)
                              const cellKey  = `${day}:${s.id}::${ci}`
                              const isActive = expandKey === cellKey
                              const br = ci === s.cols.length - 1 ? `2px solid ${s.border}` : '1px solid #f3f4f6'
                              return (
                                <CountPair key={cellKey}
                                  count={colRows.length}
                                  amt={sumAmt(colRows)}
                                  col={col} isActive={isActive}
                                  onClick={() => toggleExpand(cellKey)}
                                  borderRight={br}
                                  expanded={expanded} />
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
                            {detailMode === 'swift' && <DetailSwift rows={pagedDetail} cols={dir==='Đi' ? SWIFT_COLS_DI : SWIFT_COLS_DEN} />}
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
                  <div style={{ fontSize:11, fontWeight:400, color:C.textMuted }}>{fmtAmt(sumAmt(filteredRows))}</div>
                </td>
                {visSections.map(s => {
                  const gSecRows = filteredRows.filter(s.totalFn)
                  const gSecAmt  = sumAmt(gSecRows)
                  return (
                    <>
                      <td key={s.id+'_gcnt'} style={{
                        padding:'8px 6px', textAlign:'center', fontSize:13, fontWeight:700,
                        borderTop:`2px solid ${C.cardBorder}`, borderRight:`1px solid ${s.border}`,
                        color: s.color, background: s.bg,
                      }}>
                        {gSecRows.length || '—'}
                      </td>
                      <td key={s.id+'_gamt'} style={{
                        padding:'8px 8px', textAlign:'right', fontFamily:'monospace', fontSize:11,
                        borderTop:`2px solid ${C.cardBorder}`, borderRight:`1px solid ${s.border}`,
                        color: s.color, background: s.bg,
                      }}>
                        {gSecAmt > 0 ? gSecAmt.toLocaleString('vi-VN') : ''}
                      </td>
                      {s.cols.map((col, ci) => {
                        const gColRows = filteredRows.filter(col.filterFn)
                        const count    = gColRows.length
                        const gColAmt  = sumAmt(gColRows)
                        return (
                          <>
                            <td key={s.id+ci+'_gcnt'} style={{
                              padding:'8px 6px', textAlign:'center', fontSize:12, fontWeight:700,
                              borderTop:`2px solid ${C.cardBorder}`,
                              borderRight: ci===s.cols.length-1 ? `2px solid ${s.border}` : '1px solid #f3f4f6',
                              color: count ? col.color : '#d1d5db',
                              background: count ? col.bg : 'transparent',
                            }}>
                              {count || '—'}
                            </td>
                            <td key={s.id+ci+'_gamt'} style={{
                              padding:'8px 8px', textAlign:'right', fontFamily:'monospace', fontSize:11,
                              borderTop:`2px solid ${C.cardBorder}`,
                              borderRight: ci===s.cols.length-1 ? `2px solid ${s.border}` : '1px solid #f3f4f6',
                              color: count ? col.color : '#d1d5db',
                              background: count ? col.bg : 'transparent',
                            }}>
                              {gColAmt > 0 ? gColAmt.toLocaleString('vi-VN') : ''}
                            </td>
                          </>
                        )
                      })}
                    </>
                  )
                })}
                <td style={{ borderTop:`2px solid ${C.cardBorder}` }} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  )
}
