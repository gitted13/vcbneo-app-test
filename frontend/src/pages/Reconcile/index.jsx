import { useState, useEffect, useCallback } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { Input } from '../../components/Input'
import Pagination from '../../components/Pagination'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'

/* ── Status display map ───────────────────────────────────────────────────── */
const STATUS_META = {
  TC_KHOP:              { label: 'TC – Khớp T',        color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  TC_LECH_NGAY:         { label: 'TC – Lệch ngày',     color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  TIMEOUT_KHOP:         { label: 'Timeout – Khớp T',   color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  TIMEOUT_LECH_NGAY:    { label: 'Timeout – Lệch T+1', color: '#f59e0b', bg: '#fef9c3', border: '#fde68a' },
  THAT_BAI_KHOP:        { label: 'Thất bại – Khớp T',  color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  THAT_BAI_LECH_NGAY:   { label: 'Thất bại – Lệch',    color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
  CHI_SWIFT:            { label: 'Chỉ Swift',           color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  TC_KHOP_T:            { label: 'TC – Khớp T',        color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  TC_KHOP_T1:           { label: 'TC – Khớp T-1',      color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  KTC:                  { label: 'KTC',                 color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  TC_KHONG_CORE:        { label: 'TC – Không Core',     color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  KHOP_T_TRUOC:         { label: 'Khớp T-1',           color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  KHOP_CUNG_NGAY:       { label: 'Khớp cùng ngày',     color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  KHOP_T_SAU:           { label: 'Khớp T+1',           color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  CORE_SWIFT_T_TRUOC:   { label: 'Swift T-1',          color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  CORE_KHOP:            { label: 'Khớp ngày T',        color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  CORE_SWIFT_T_SAU:     { label: 'Swift T+1',          color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  CORE_THAT_BAI:        { label: 'Thất bại',           color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  KHOP_NAPAS_T_TRUOC:   { label: 'NAPAS T-1',          color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  KHOP_NAPAS_CUNG_NGAY: { label: 'NAPAS cùng ngày',    color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  KHOP_NAPAS_T_SAU:     { label: 'NAPAS T+1',          color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  CHI_CORE:             { label: 'Chỉ Core',           color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  KHOP:                 { label: 'Khớp',               color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  CHI_TRAI:             { label: 'Chỉ nguồn trái',     color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  CHI_PHAI:             { label: 'Chỉ nguồn phải',     color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
}

function statusMeta(code) {
  if (!code) return { label: code ?? '—', color: C.textMuted, bg: C.neutralBg, border: C.cardBorder }
  return STATUS_META[code] ?? { label: code, color: C.textMuted, bg: C.neutralBg, border: C.cardBorder }
}

/* ── Column definitions per config ───────────────────────────────────────── */
const CONFIG_COLS = {
  1: {
    left:  [{ k: 'trace_number', l: 'Trace Swift' }, { k: 'số_tiền', l: 'Số tiền', fmt: 'amt' }, { k: 'tinh_trạng_phản_hồi', l: 'TT Swift' }, { k: 'hostdate', l: 'Ngày GN' }],
    right: [{ k: 'số_trace', l: 'Trace NAPAS' }, { k: 'ngày_gd', l: 'Ngày NAPAS' }],
  },
  2: {
    left:  [{ k: 'trace', l: 'Trace Swift' }, { k: 'số_tiền', l: 'Số tiền', fmt: 'amt' }, { k: 'tinh_trạng_phản_hồi', l: 'TT Swift' }, { k: 'host_date', l: 'Ngày GN' }],
    right: [{ k: 'số_trace', l: 'Trace NAPAS' }, { k: 'ngày_gd', l: 'Ngày NAPAS' }],
  },
  3: {
    left:  [{ k: 'seq', l: 'Seq Swift' }, { k: 'số_tiền', l: 'Số tiền', fmt: 'amt' }, { k: 'tinh_trạng_phản_hồi', l: 'TT Swift' }, { k: 'hostdate', l: 'Ngày GN' }],
    right: [{ k: 'sequence', l: 'Seq Core' }, { k: 'số_tiền_ghi_nợ', l: 'Ghi nợ', fmt: 'amt' }, { k: 'ngày_giao_dịch', l: 'Ngày Core' }],
  },
  4: {
    left:  [{ k: 'seq', l: 'Seq Swift' }, { k: 'số_tiền', l: 'Số tiền', fmt: 'amt' }, { k: 'tinh_trạng_phản_hồi', l: 'TT Swift' }, { k: 'host_date', l: 'Ngày GN' }],
    right: [{ k: 'sequence', l: 'Seq Core' }, { k: 'số_tiền_ghi_có', l: 'Ghi có', fmt: 'amt' }, { k: 'ngày_giao_dịch', l: 'Ngày Core' }],
  },
  5: {
    left:  [{ k: 'trace', l: 'Trace Core' }, { k: 'số_tiền_ghi_nợ', l: 'Ghi nợ', fmt: 'amt' }, { k: 'ngày_giao_dịch', l: 'Ngày Core' }],
    right: [{ k: 'số_trace', l: 'Trace NAPAS' }, { k: 'số_tiền', l: 'Số tiền', fmt: 'amt' }, { k: 'ngày_gd', l: 'Ngày NAPAS' }],
  },
  6: {
    left:  [{ k: 'trace', l: 'Trace Core' }, { k: 'số_tiền_ghi_có', l: 'Ghi có', fmt: 'amt' }, { k: 'ngày_giao_dịch', l: 'Ngày Core' }],
    right: [{ k: 'số_trace', l: 'Trace NAPAS' }, { k: 'số_tiền', l: 'Số tiền', fmt: 'amt' }, { k: 'ngày_gd', l: 'Ngày NAPAS' }],
  },
}

/* ── Pair colors ──────────────────────────────────────────────────────────── */
const PAIR_COLOR = {
  'Swift|NAPAS': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'Swift|Core':  { color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  'Core|NAPAS':  { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
}
function pairColor(cfg) {
  const k = `${cfg.leftSource}|${cfg.rightSource}`
  return PAIR_COLOR[k] ?? { color: C.primary, bg: C.neutralBg, border: C.cardBorder }
}

const fmtAmt = v => {
  const n = parseFloat(v)
  return isNaN(n) ? (v ?? '—') : n.toLocaleString('vi-VN') + ' ₫'
}
const fmtCell = (col, data) => {
  const v = data?.[col.k]
  if (v === undefined || v === null || v === '') return '—'
  return col.fmt === 'amt' ? fmtAmt(v) : String(v)
}

/* ── StatusBadge ──────────────────────────────────────────────────────────── */
function StatusBadge({ code }) {
  const m = statusMeta(code)
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>{m.label}</span>
  )
}

/* ── Config Card ──────────────────────────────────────────────────────────── */
function ConfigCard({ cfg, summary, running, onRun, onSelect, active }) {
  const pc = pairColor(cfg)
  const dirColor = cfg.direction === 'Đi' ? '#2563eb' : '#7c3aed'
  const matched = summary?.by_status?.filter(s => !['CHI_TRAI', 'CHI_SWIFT', 'CHI_CORE', 'CHI_PHAI', 'KTC', 'TC_KHONG_CORE'].includes(s.status))
    .reduce((a, s) => a + s.count, 0) ?? null
  const total = summary?.total ?? null

  return (
    <div
      onClick={onSelect}
      style={{
        background: '#fff', borderRadius: radius.lg,
        border: `2px solid ${active ? pc.color : C.cardBorder}`,
        boxShadow: active ? `0 0 0 3px ${pc.border}` : shadow.sm,
        padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: pc.color }}>
            {cfg.leftSource} ↔ {cfg.rightSource}
          </div>
          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: dirColor + '15', color: dirColor }}>
              {cfg.direction}
            </span>
            {summary?.run_date && (
              <span style={{ fontSize: 11, color: C.textMuted }}>{summary.run_date}</span>
            )}
            {summary?.has_stale && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 5px' }}>STALE</span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={running ? 'ghost' : 'primary'}
          onClick={e => { e.stopPropagation(); onRun() }}
          disabled={running}
        >
          {running ? '⟳ Đang chạy...' : '▶ Chạy'}
        </Button>
      </div>

      {total !== null ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            Tổng: <b style={{ color: C.text }}>{total}</b>
          </div>
          {matched !== null && (
            <div style={{ fontSize: 11, color: C.textMuted }}>
              Khớp: <b style={{ color: '#059669' }}>{matched}</b>
            </div>
          )}
          {summary?.by_status?.slice(0, 3).map(s => (
            <span key={s.status} style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 700,
              background: statusMeta(s.status).bg, color: statusMeta(s.status).color,
              border: `1px solid ${statusMeta(s.status).border}`,
            }}>{s.count}</span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>Chưa chạy</div>
      )}
    </div>
  )
}

/* ── Results Panel ────────────────────────────────────────────────────────── */
function ResultsPanel({ cfg, results, summary, runDates, selectedDate, onDateChange, onPatch, canAnnotate }) {
  const [search, setSearch]       = useState('')
  const [filterStatus, setFS]     = useState('')
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(50)
  const [annotating, setAnn]      = useState(null) // result id
  const [noteInput, setNote]      = useState('')
  const [patchingId, setPId]      = useState(null)
  const { toast } = useApp()

  const cols = CONFIG_COLS[cfg.id] ?? { left: [], right: [] }
  const allCols = [...cols.left, ...cols.right]

  const statusCodes = [...new Set(results.map(r => r.status_override || r.status).filter(Boolean))]

  const filtered = results.filter(r => {
    const st = r.status_override || r.status
    if (filterStatus && st !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      const found = allCols.some(col => String(r.merged_data?.[col.k] ?? '').toLowerCase().includes(q))
      if (!found) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows   = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handlePatch = async (id, patch) => {
    setPId(id)
    try {
      await api.reconcileConfig.patchFlexResult(id, patch)
      onPatch(id, patch)
      setAnn(null)
      toast('Đã lưu ghi chú.', 'success')
    } catch {
      toast('Lưu thất bại.', 'error')
    } finally {
      setPId(null)
    }
  }

  const th = (extra = {}) => ({
    padding: '6px 10px', fontSize: 11, fontWeight: 700, color: C.textMuted,
    background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`,
    textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap',
    textAlign: 'left', ...extra,
  })
  const td = (extra = {}) => ({
    padding: '7px 10px', borderBottom: `1px solid ${C.cardBorder}`,
    fontSize: 12, verticalAlign: 'middle', ...extra,
  })

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
          {cfg.leftSource} ↔ {cfg.rightSource} — {cfg.direction}
        </div>
        {summary && (
          <div style={{ fontSize: 12, color: C.textMuted }}>
            {summary.total} dòng ·{' '}
            {summary.by_status.map(s => (
              <span key={s.status} style={{ marginRight: 8 }}>
                <b style={{ color: statusMeta(s.status).color }}>{s.count}</b> {statusMeta(s.status).label}
              </span>
            ))}
          </div>
        )}
        {/* Run date selector */}
        {runDates.length > 0 && (
          <select
            value={selectedDate ?? ''}
            onChange={e => onDateChange(e.target.value || null)}
            style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, border: `1px solid ${C.cardBorder}`, background: '#fff', marginLeft: 'auto' }}
          >
            <option value=''>Lần chạy mới nhất</option>
            {runDates.map(d => (
              <option key={d.run_date} value={d.run_date}>
                {d.run_date} ({d.row_count} dòng{d.has_stale ? ', stale' : ''})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Tìm kiếm..."
          style={{ width: 200, fontSize: 12, padding: '5px 8px' }}
        />
        <select
          value={filterStatus}
          onChange={e => { setFS(e.target.value); setPage(1) }}
          style={{ fontSize: 12, padding: '5px 8px', borderRadius: 4, border: `1px solid ${C.cardBorder}`, background: '#fff' }}
        >
          <option value=''>Tất cả trạng thái ({results.length})</option>
          {statusCodes.map(s => (
            <option key={s} value={s}>{statusMeta(s).label} ({results.filter(r => (r.status_override || r.status) === s).length})</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted }}>
          {filtered.length} dòng{totalPages > 1 ? ` · Trang ${page}/${totalPages}` : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={th()}>STT</th>
              {cols.left.map(c => <th key={c.k} style={th({ background: '#eff6ff' })}>{c.l}</th>)}
              <th style={th({ background: '#e8f4fd', borderLeft: '2px solid #93c5fd', borderRight: '2px solid #93c5fd' })}>Khớp</th>
              {cols.right.map(c => <th key={c.k} style={th({ background: '#f0fdf4' })}>{c.l}</th>)}
              <th style={th()}>Trạng thái</th>
              <th style={th()}>Ghi chú</th>
              {canAnnotate && <th style={th({ width: 60 })}></th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, idx) => {
              const isMatched = r.matched_ids?.pair_1 != null
              const effStatus = r.status_override || r.status
              const sm = statusMeta(effStatus)
              const isAnn = annotating === r.id

              return (
                <>
                  <tr key={r.id} style={{ background: idx % 2 ? C.neutralBg : '#fff' }}>
                    <td style={td({ color: C.textMuted, textAlign: 'right', width: 40 })}>{(page - 1) * pageSize + idx + 1}</td>

                    {cols.left.map(c => (
                      <td key={c.k} style={td({ background: idx % 2 ? '#f0f5ff' : '#f8fbff', fontFamily: c.fmt === 'amt' ? 'monospace' : 'inherit' })}>
                        {fmtCell(c, r.merged_data)}
                      </td>
                    ))}

                    <td style={td({ textAlign: 'center', borderLeft: '2px solid #93c5fd', borderRight: '2px solid #93c5fd' })}>
                      {isMatched
                        ? <span style={{ color: '#059669', fontWeight: 700, fontSize: 14 }}>✓</span>
                        : <span style={{ color: '#dc2626', fontSize: 14 }}>✗</span>}
                    </td>

                    {cols.right.map(c => (
                      <td key={c.k} style={td({ background: isMatched ? (idx % 2 ? '#f0fdf0' : '#f7fdf9') : (idx % 2 ? '#fef2f2' : '#fff8f8'), fontFamily: c.fmt === 'amt' ? 'monospace' : 'inherit' })}>
                        {isMatched ? fmtCell(c, r.merged_data) : <span style={{ color: C.textLight }}>—</span>}
                      </td>
                    ))}

                    <td style={td()}>
                      <StatusBadge code={effStatus} />
                      {r.is_stale && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 700, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 3, padding: '1px 4px' }}>STALE</span>}
                      {r.status_override && <span style={{ marginLeft: 4, fontSize: 9, color: '#7c3aed', fontWeight: 700 }}>manual</span>}
                    </td>

                    <td style={td({ maxWidth: 180 })}>
                      {r.resolved_by
                        ? <span style={{ fontSize: 11, color: C.textMuted }}>{r.resolved_by}: {r.note ?? ''}</span>
                        : <span style={{ color: C.textLight, fontSize: 11 }}>—</span>}
                    </td>

                    {canAnnotate && (
                      <td style={td({ textAlign: 'center' })}>
                        <button
                          onClick={() => { setAnn(isAnn ? null : r.id); setNote(r.note ?? '') }}
                          style={{ background: 'none', border: `1px solid ${C.cardBorder}`, borderRadius: 4, padding: '3px 7px', cursor: 'pointer', fontSize: 12, color: C.textMuted }}
                        >✎</button>
                      </td>
                    )}
                  </tr>

                  {isAnn && (
                    <tr key={`ann_${r.id}`}>
                      <td colSpan={99} style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: `1px solid ${C.cardBorder}`, borderLeft: `3px solid #f59e0b` }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>Ghi chú:</span>
                          <Input
                            value={noteInput}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Nhập ghi chú xử lý..."
                            style={{ flex: 1, minWidth: 200, fontSize: 12 }}
                          />
                          <Button
                            size="sm"
                            disabled={patchingId === r.id}
                            onClick={() => handlePatch(r.id, { note: noteInput, resolved_by: 'user' })}
                          >
                            {patchingId === r.id ? 'Đang lưu...' : 'Lưu'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAnn(null)}>Hủy</Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}

            {pageRows.length === 0 && (
              <tr>
                <td colSpan={99} style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>
                  {results.length === 0 ? 'Chưa có kết quả — nhấn Chạy để bắt đầu đối soát.' : 'Không có dòng phù hợp.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={setPageSize}
        itemLabel="dòng"
      />
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function Reconcile() {
  const { toast }   = useApp()
  const { user }    = useAuth()
  const canAnnotate = user?.role !== 'Viewer'

  const [configs,  setConfigs]  = useState([])
  const [loading,  setLoading]  = useState(true)

  // Per-config state
  const [summaries,  setSummaries]  = useState({})  // config_id → summary
  const [results,    setResults]    = useState({})   // config_id → rows[]
  const [runDates,   setRunDates]   = useState({})   // config_id → date[]
  const [selDate,    setSelDate]    = useState({})   // config_id → date | null
  const [running,    setRunning]    = useState({})   // config_id → bool
  const [loadingRes, setLoadingRes] = useState({})   // config_id → bool

  const [selectedId, setSelectedId] = useState(null)

  // Load configs
  useEffect(() => {
    api.reconcileConfig.getJoinConfigs()
      .then(items => {
        setConfigs(items.map(i => ({ ...i, ...i.config, id: i.id })))
        // Load summaries for all configs
        items.forEach(item => loadSummary(item.id, null))
      })
      .catch(() => toast('Không thể tải cấu hình đối soát.', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const loadSummary = useCallback((configId, runDate) => {
    api.reconcileConfig.getFlexSummary(configId, runDate)
      .then(s => setSummaries(p => ({ ...p, [configId]: s })))
      .catch(() => {}) // no summary yet = no results
  }, [])

  const loadResults = useCallback((configId, runDate) => {
    setLoadingRes(p => ({ ...p, [configId]: true }))
    Promise.all([
      api.reconcileConfig.getFlexResults(configId, runDate),
      api.reconcileConfig.getFlexRunDates(configId),
    ])
      .then(([rows, dates]) => {
        setResults(p => ({ ...p, [configId]: rows }))
        setRunDates(p => ({ ...p, [configId]: dates }))
      })
      .catch(() => toast('Không thể tải kết quả.', 'error'))
      .finally(() => setLoadingRes(p => ({ ...p, [configId]: false })))
  }, [])

  // Load results when config is selected
  useEffect(() => {
    if (selectedId) loadResults(selectedId, selDate[selectedId] ?? null)
  }, [selectedId])

  const handleRun = async (configId) => {
    setRunning(p => ({ ...p, [configId]: true }))
    try {
      const res = await api.reconcileConfig.runFlex(configId)
      toast(`Đã chạy: ${res.inserted} dòng kết quả.`, 'success')
      loadSummary(configId, null)
      if (selectedId === configId) loadResults(configId, null)
    } catch (e) {
      toast(`Lỗi: ${e.message}`, 'error')
    } finally {
      setRunning(p => ({ ...p, [configId]: false }))
    }
  }

  const handleDateChange = (configId, date) => {
    setSelDate(p => ({ ...p, [configId]: date }))
    loadResults(configId, date)
    loadSummary(configId, date)
  }

  const handlePatch = (configId, resultId, patch) => {
    setResults(p => ({
      ...p,
      [configId]: (p[configId] ?? []).map(r =>
        r.id === resultId ? { ...r, ...patch } : r
      ),
    }))
  }

  const selectedCfg     = configs.find(c => c.id === selectedId)
  const selectedResults = results[selectedId] ?? []
  const selectedSummary = summaries[selectedId]
  const selectedDates   = runDates[selectedId] ?? []

  if (loading) {
    return (
      <PageShell title="Kết quả đối soát" subtitle="Chạy đối soát và xem kết quả theo từng cặp nguồn dữ liệu.">
        <div style={{ padding: '60px 0', textAlign: 'center', color: C.textMuted }}>Đang tải cấu hình...</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Kết quả đối soát"
      subtitle="Chọn cặp đối soát → Chạy → Xem kết quả. Dữ liệu thực từ DB."
    >
      {/* Config grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {configs.map(cfg => (
          <ConfigCard
            key={cfg.id}
            cfg={cfg}
            summary={summaries[cfg.id]}
            running={!!running[cfg.id]}
            active={selectedId === cfg.id}
            onRun={() => handleRun(cfg.id)}
            onSelect={() => setSelectedId(cfg.id === selectedId ? null : cfg.id)}
          />
        ))}
      </div>

      {/* Results */}
      {selectedCfg && (
        loadingRes[selectedId]
          ? <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>Đang tải kết quả...</div>
          : (
            <ResultsPanel
              cfg={selectedCfg}
              results={selectedResults}
              summary={selectedSummary}
              runDates={selectedDates}
              selectedDate={selDate[selectedId] ?? null}
              onDateChange={date => handleDateChange(selectedId, date)}
              onPatch={(rid, patch) => handlePatch(selectedId, rid, patch)}
              canAnnotate={canAnnotate}
            />
          )
      )}

      {!selectedId && configs.length > 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          Chọn một cặp đối soát ở trên để xem kết quả chi tiết.
        </div>
      )}
    </PageShell>
  )
}
