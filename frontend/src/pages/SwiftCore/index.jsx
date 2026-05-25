import { useState, useEffect } from 'react'
import Pagination from '../../components/Pagination'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'
import { RESOLUTION_OF, SWIFT_COLS_DI, SWIFT_COLS_DEN, isT1 } from '../../data/reconcile'
import { downloadDetailXlsx } from '../../utils/export'
import { DirectionToggle, KpiBar, ResolveRow, SwiftStatusCell, StatusBadge, Dash } from '../../components/ReconShared'
import { api } from '../../api/client'

export default function SwiftCore() {
  const { user } = useAuth()
  const { toast } = useApp()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDbRows()
      .then(res => setRows(res.rows ?? []))
      .catch(() => toast('Không thể tải dữ liệu từ server.', 'error'))
      .finally(() => setLoading(false))
  }, [])
  const [dir, setDir]        = useState('Đi')
  const [search, setSearch]  = useState('')
  const [filterCol, setFC]   = useState('')
  const [activeKpi, setKpi]  = useState(null)
  const [activeView, setView] = useState('all')
  const [resolvingId, setRI]  = useState(null)
  const [noteInput, setNote]  = useState('')
  const [page, setPage]       = useState(1)
  const [pageSize, setPS]     = useState(30)
  const { filterFrom, setFilterFrom: setFrom, filterTo, setFilterTo: setTo } = useApp()
  const toggleKpi = key => setKpi(p => p === key ? null : key)

  const dayToISO = s => { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}` }

  const canResolve = user?.role === 'Admin' || user?.role === 'Operator'

  const onResolve = (rowId, note) => {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, resolved_by: user?.username ?? user?.name ?? 'user', resolved_at: new Date().toLocaleString('vi-VN'), note }
      : r
    ))
    toast(`Đã xử lý giao dịch ${row?.trace}.`, 'success')
  }

  const activeCols = dir === 'Đi' ? SWIFT_COLS_DI : SWIFT_COLS_DEN
  const KPI_FN     = Object.fromEntries(activeCols.map((col, i) => [`col${i}`, col.filterFn]))

  const base          = rows.filter(r => r.swift && r.direction === dir)
  const dateBase      = base.filter(r => {
    if (filterFrom && r.day && dayToISO(r.day) < filterFrom) return false
    if (filterTo   && r.day && dayToISO(r.day) > filterTo)   return false
    return true
  })
  const unmatchedBase = dateBase.filter(r => !r.core)
  const viewBase      = activeView === 'unmatched' ? unmatchedBase : dateBase

  const filtered = viewBase.filter(r => {
    if (search && !r.trace.includes(search) && !(r.sequence ?? '').includes(search)) return false
    if (activeView === 'all') {
      if (activeKpi && KPI_FN[activeKpi] && !KPI_FN[activeKpi](r)) return false
      if (filterCol !== '' && !activeCols[parseInt(filterCol)]?.filterFn(r)) return false
    }
    return true
  })
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1); setFC(''); setFrom(''); setTo(''); setKpi(null); setView('all') }, [dir])
  useEffect(() => { setPage(1) }, [filterCol, activeKpi, search, activeView, filterFrom, filterTo])

  const kpiItems = [
    { label: 'Tổng', val: dateBase.length, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', onClick: () => setKpi(null), isActive: false },
    ...activeCols.map((col, i) => ({
      label: col.label, val: dateBase.filter(col.filterFn).length,
      color: col.color, bg: col.bg, border: col.border,
      onClick: () => toggleKpi(`col${i}`), isActive: activeKpi === `col${i}`,
    })),
  ]

  const th = (extra = {}) => ({
    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`,
    textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', ...extra,
  })
  const COLS = 11

  const coreLabel  = dir === 'Đi' ? 'GHI CÓ' : 'GHI NỢ'
  const coreColor  = dir === 'Đi' ? '#166534' : '#1e40af'
  const coreBg     = dir === 'Đi' ? '#dcfce7'  : '#dbeafe'
  const coreBorder = dir === 'Đi' ? '#bbf7d0'  : '#bfdbfe'
  const coreAcc    = dir === 'Đi' ? '#86efac'  : '#93c5fd'
  const coreCellBg = dir === 'Đi' ? '#f0fdf4'  : '#eff6ff'

  const handleExport = async () => {
    const STATUS = { THANH_CONG: 'Thành công', TIMEOUT: 'Timeout', THAT_BAI: 'Thất bại' }
    const headers = ['Ngày', 'Trace', 'Sequence', 'Số tiền (VNĐ)', 'Ngày GD thực tế', 'Ngày ghi nhận', 'TT Swift', 'Ngày Core', 'Loại ghi', 'Kết quả khớp']
    const rows = filtered.map(r => {
      const col = activeCols.find(c => c.filterFn(r))
      return [r.day, r.trace, r.sequence ?? '', r.amount, r.swift?.txnDate ?? '', r.swift?.date ?? '', STATUS[r.swift?.status] ?? '', r.core?.date ?? '', r.core?.entry ?? '', col?.label ?? r.recon_status]
    })
    const date = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')
    await downloadDetailXlsx({ title: 'ĐỐI CHIẾU SWIFT – CORE GL', dir, filterFrom, filterTo, headers, rows, headerBg: '#1e40af', filename: `Swift_Core_${dir}_${date}` })
  }

  if (loading) return <PageShell title="Đối chiếu Swift với Core GL"><div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Đang tải dữ liệu...</div></PageShell>

  return (
    <PageShell
      title="Đối chiếu Swift với Core GL"
      subtitle="Swift làm nguồn gốc — kiểm tra từng giao dịch Swift có khớp bên Core GL không."
    >
      {/* Data flow banner */}
      <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f8fafc', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Luồng đối chiếu</div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 800, color: '#1d4ed8' }}>Swift Đi</span>
            <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 700 }}>→</span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#dcfce7', border: '1px solid #86efac', fontSize: 12, fontWeight: 800, color: '#166534' }}>Core Ghi có</span>
            <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>khớp bằng Sequence + Số tiền</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: 12, fontWeight: 800, color: '#7c3aed' }}>Swift Đến</span>
            <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 700 }}>→</span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#dbeafe', border: '1px solid #93c5fd', fontSize: 12, fontWeight: 800, color: '#1e40af' }}>Core Ghi nợ</span>
            <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>khớp bằng Sequence + Số tiền</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid #e5e7eb', paddingLeft: 16 }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>
              <b>Ngày ghi nhận</b> = HOSTDATE (ngày Swift xử lý) &nbsp;|&nbsp;
              <b>Ngày GD</b> = THỜI GIAN thực tế &nbsp;|&nbsp;
              <b>T+1</b> khi hai ngày khác nhau
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <DirectionToggle value={dir} onChange={d => { setDir(d); setRI(null) }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {dir === 'Đi'
            ? 'Swift Đi làm gốc → kiểm tra từng giao dịch khớp với Core Ghi có'
            : 'Swift Đến làm gốc → kiểm tra từng giao dịch khớp với Core Ghi nợ'}
        </span>
      </div>

      {/* View tab switcher */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 16 }}>
        {[
          { key: 'all',       label: 'Tất cả',     count: dateBase.length,      color: C.primary, badgeBg: '#eff6ff' },
          { key: 'unmatched', label: 'Không khớp', count: unmatchedBase.length, color: '#dc2626', badgeBg: '#fef2f2' },
        ].map(t => {
          const active = activeView === t.key
          return (
            <button key={t.key} onClick={() => { setView(t.key); setPage(1) }}
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

      {activeView === 'all' && <KpiBar items={kpiItems} />}
      {activeView === 'unmatched' && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: radius.md, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, flexShrink: 0, color: '#dc2626', fontWeight: 700 }}>!</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
              {unmatchedBase.length} giao dịch Swift không tìm được đối ứng bên Core GL
            </div>
            <div style={{ fontSize: 11, color: '#9b1c1c', marginTop: 2 }}>
              Các giao dịch này có trạng thái Chỉ Swift, Swift timeout hoặc Swift thất bại — cần kiểm tra thủ công từng trường hợp.
            </div>
          </div>
        </div>
      )}
      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg, flexWrap: 'wrap' }}>
          <Input placeholder="Tìm trace, sequence..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Input type="date" value={filterFrom} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
            <span style={{ fontSize: 12, color: C.textMuted, flexShrink: 0 }}>–</span>
            <Input type="date" value={filterTo} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
          </div>
          <Select value={filterCol} onChange={e => setFC(e.target.value)} style={{ width: 260 }}>
            <option value="">Tất cả kết quả</option>
            {activeCols.map((col, i) => (
              <option key={i} value={i}>{col.label}</option>
            ))}
          </Select>
          <Button size="sm" variant="subtle" onClick={handleExport}>↓ Xuất Excel</Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th colSpan={6} style={{ background: '#eff6ff', borderBottom: `1px solid #bfdbfe`, padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#1e40af' }}>
                  SWIFT (nguồn gốc)
                </th>
                <th colSpan={2} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: coreBg, color: coreColor, borderBottom: `1px solid ${coreBorder}`, borderLeft: `2px solid ${coreAcc}` }}>
                  CORE {coreLabel} (đối chiếu)
                </th>
                <th colSpan={3} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
              </tr>
              <tr>
                <th style={th()}>#</th>
                <th style={th()}>Trace</th>
                <th style={th()}>Sequence</th>
                <th style={th({ background: '#eff6ff' })}>Ngày GD (thực tế)</th>
                <th style={th({ background: '#eff6ff' })}>Ngày GN (ghi nhận)</th>
                <th style={th({ background: '#eff6ff' })}>Trạng thái Swift</th>
                <th style={th({ borderLeft: `2px solid ${coreAcc}`, background: coreCellBg })}>Ngày Core</th>
                <th style={th({ background: coreCellBg })}>Loại ghi</th>
                <th style={th()}>Số tiền</th>
                <th style={th()}>Kết quả khớp</th>
                <th style={th()}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => {
                const isResolving = resolvingId === r.id
                const res  = RESOLUTION_OF[r.recon_status]
                const t1   = isT1(r)
                const bg   = i % 2 ? C.neutralBg : '#fff'
                const cBg  = r.core ? (bg === '#fff' ? (dir === 'Đi' ? '#f7fdf9' : '#f0f4ff') : (dir === 'Đi' ? '#f0fdf4' : '#eff6ff')) : bg
                const sBg  = bg === '#fff' ? '#f8fbff' : '#f2f8ff'
                const td   = (ex = {}) => ({ padding: '9px 12px', borderBottom: isResolving ? 'none' : `1px solid ${C.cardBorder}`, background: bg, ...ex })

                return (
                  <>
                    <tr key={r.id}>
                      <td style={td({ color: C.textMuted, fontSize: 11 })}>{(page - 1) * pageSize + i + 1}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.primary, fontWeight: 600, fontSize: 12, background: sBg })}>{r.trace}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.textMuted, fontSize: 11, background: sBg })}>{r.sequence ?? '—'}</td>
                      <td style={td({ background: sBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>
                        {r.swift?.txnDate ?? '—'}
                      </td>
                      <td style={td({ background: sBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>
                        {r.swift?.date ?? '—'}
                        {t1 && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#0891b2', background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 3, padding: '1px 4px' }}>T+1</span>}
                      </td>
                      <td style={td({ background: sBg })}><SwiftStatusCell status={r.swift?.status} /></td>
                      <td style={td({ borderLeft: `2px solid ${coreAcc}`, background: cBg, fontSize: 12, color: C.textMuted })}>{r.core?.date ?? '—'}</td>
                      <td style={td({ background: cBg })}>
                        {r.core?.entry
                          ? <span style={{ fontSize: 12, fontWeight: 700, color: r.core.entry === 'Ghi có' ? '#166534' : '#1e40af' }}>{r.core.entry}</span>
                          : <Dash />}
                      </td>
                      <td style={td({ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' })}>{r.amount.toLocaleString('vi-VN')} ₫</td>
                      <td style={td()}>{(() => { const c = activeCols.find(col => col.filterFn(r)); return c ? <span style={{ padding:'3px 8px', borderRadius:4, fontSize:11, fontWeight:700, background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>{c.label}</span> : <StatusBadge status={r.recon_status} /> })()}</td>
                      <td style={td({ whiteSpace: 'nowrap' })}>
                        {r.resolved_by
                          ? <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ {r.resolved_by}</span>
                          : res?.needsAction && canResolve
                          ? <Button size="sm" variant="ghost" onClick={() => { setRI(r.id); setNote('') }}>Xử lý</Button>
                          : res
                          ? <span style={{ fontSize: 11, color: res.color, fontWeight: 600 }}>{res.label}</span>
                          : null}
                      </td>
                    </tr>
                    {r.resolved_by && r.note && !isResolving && (
                      <tr key={r.id + '_n'}>
                        <td colSpan={COLS} style={{ padding: '3px 12px 5px 52px', fontSize: 11, color: '#059669', background: '#f0fdf4', borderBottom: `1px solid ${C.cardBorder}`, borderLeft: '3px solid #86efac' }}>
                          Ghi chú: <i>{r.note}</i>
                        </td>
                      </tr>
                    )}
                    {isResolving && (
                      <ResolveRow cols={COLS} noteInput={noteInput} setNote={setNote}
                        onConfirm={() => { onResolve(r.id, noteInput); setRI(null); setNote('') }}
                        onCancel={() => setRI(null)} />
                    )}
                  </>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={COLS} style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Không có bản ghi phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          total={filtered.length}
          page={page} pageSize={pageSize}
          onPage={setPage} onPageSize={setPS}
        />
      </div>
    </PageShell>
  )
}
