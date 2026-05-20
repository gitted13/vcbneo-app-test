import { useState, useEffect } from 'react'
import Pagination from '../../components/Pagination'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'
import { RESOLUTION_OF, NAPAS_COLS_DI, NAPAS_COLS_DEN, isT1 } from '../../data/reconcile'
import { DirectionToggle, KpiBar, ResolveRow, NapasStatusCell, NapasTypeTag, StatusBadge, Dash } from '../../components/ReconShared'
import { api } from '../../api/client'

export default function NapasCore() {
  const { user } = useAuth()
  const { toast } = useApp()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getRows()
      .then(res => setRows(res.rows ?? []))
      .catch(() => toast('Không thể tải dữ liệu từ server.', 'error'))
      .finally(() => setLoading(false))
  }, [])
  const [dir, setDir]        = useState('Đi')
  const [search, setSearch]  = useState('')
  const [filterCol, setFC]   = useState('')
  const [filterKTC, setKTC]  = useState('')
  const [activeView, setView] = useState('all')
  const [resolvingId, setRI] = useState(null)
  const [noteInput, setNote] = useState('')
  const [page, setPage]      = useState(1)
  const [pageSize, setPS]    = useState(30)
  const [activeKpi, setKpi]  = useState(null)
  const [filterDay, setFD]   = useState('')

  const canResolve = user?.role === 'Admin' || user?.role === 'Operator'
  const toggleKpi = key => setKpi(p => p === key ? null : key)

  const onResolve = (rowId, note) => {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, resolved_by: user?.username ?? user?.name ?? 'user', resolved_at: new Date().toLocaleString('vi-VN'), note }
      : r
    ))
    toast(`Đã xử lý giao dịch ${row?.trace}.`, 'success')
  }

  const activeCols    = dir === 'Đi' ? NAPAS_COLS_DI : NAPAS_COLS_DEN
  const base          = rows.filter(r => r.napas && r.direction === dir)
  const days          = [...new Set(base.map(r => r.day))].filter(Boolean).sort()
  const unmatchedBase = base.filter(r => !r.core)
  const needsActBase  = base.filter(r => RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by)
  const viewBase      = activeView === 'unmatched'    ? unmatchedBase
                      : activeView === 'needs_action' ? needsActBase
                      : base

  const KPI_FN = dir === 'Đi' ? {
    tc_t:   r => !r.napas?.failed && !!r.core && !isT1(r),
    tc_tm1: r => !r.napas?.failed && !!r.core &&  isT1(r),
    ktc:    r =>  !!r.napas?.failed,
  } : {
    tc_t:     r => !r.napas?.failed && !!r.core && r.napas?.date === r.core?.date,
    tc_tm1:   r => !r.napas?.failed && !!r.core && r.napas?.type === 'QT' && r.napas?.date !== r.core?.date,
    chi_core: r => !r.napas?.failed && !r.core,
  }

  const filtered = viewBase.filter(r => {
    if (filterDay && r.day !== filterDay) return false
    if (search && !r.trace.includes(search) && !(r.sequence ?? '').includes(search)) return false
    if (activeView === 'all') {
      if (activeKpi && KPI_FN[activeKpi] && !KPI_FN[activeKpi](r)) return false
      if (filterCol !== '' && !activeCols[parseInt(filterCol)]?.filterFn(r)) return false
      if (filterKTC === 'TC'  &&  r.napas.failed) return false
      if (filterKTC === 'KTC' && !r.napas.failed) return false
    }
    return true
  })
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1); setFC(''); setKTC(''); setFD(''); setKpi(null); setView('all') }, [dir])
  useEffect(() => { setPage(1) }, [filterCol, filterKTC, activeKpi, search, activeView])

  /* KPI metrics */
  let kpiItems
  if (dir === 'Đi') {
    const tc     = base.filter(r => !r.napas.failed && r.core)
    const tcT    = tc.filter(r => !isT1(r))
    const tcTm1  = tc.filter(r =>  isT1(r))
    const ktc    = base.filter(r =>  r.napas.failed)
    kpiItems = [
      { label: 'Tổng NAPAS Đi',        val: base.length,  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      { label: 'Thành công – Core ngày T',   val: tcT.length,   color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', onClick: () => toggleKpi('tc_t'),   isActive: activeKpi === 'tc_t' },
      { label: 'Thành công – Core ngày T-1', val: tcTm1.length, color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', onClick: () => toggleKpi('tc_tm1'), isActive: activeKpi === 'tc_tm1' },
      { label: 'Không thành công',           val: ktc.length,   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', onClick: () => toggleKpi('ktc'),    isActive: activeKpi === 'ktc' },
    ]
  } else {
    const tc      = base.filter(r => !r.napas.failed && r.core)
    const tcT     = tc.filter(r => r.napas.date === r.core?.date)
    const tcTm1   = tc.filter(r => r.napas.type === 'QT' && r.napas.date !== r.core?.date)
    const chiCore = base.filter(r => !r.napas.failed && !r.core)
    kpiItems = [
      { label: 'Tổng NAPAS Đến',       val: base.length,    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      { label: 'Thành công – Core ngày T',   val: tcT.length,    color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', onClick: () => toggleKpi('tc_t'),    isActive: activeKpi === 'tc_t' },
      { label: 'Thành công – Core ngày T-1', val: tcTm1.length,  color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', onClick: () => toggleKpi('tc_tm1'),  isActive: activeKpi === 'tc_tm1' },
      { label: 'Core không ghi nhận',        val: chiCore.length, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', onClick: () => toggleKpi('chi_core'), isActive: activeKpi === 'chi_core' },
    ]
  }

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

  if (loading) return <PageShell title="Đối chiếu NAPAS với Core GL"><div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Đang tải dữ liệu...</div></PageShell>

  return (
    <PageShell
      title="Đối chiếu NAPAS với Core GL"
      subtitle="NAPAS làm nguồn gốc — kiểm tra từng giao dịch NAPAS có khớp bên Core GL không."
    >
      {/* Data flow banner */}
      <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f8fafc', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Luồng đối chiếu</div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#fefce8', border: '1px solid #fde68a', fontSize: 12, fontWeight: 800, color: '#854d0e' }}>NAPAS Đi (TC/KTC)</span>
            <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 700 }}>→</span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#dcfce7', border: '1px solid #86efac', fontSize: 12, fontWeight: 800, color: '#166534' }}>Core Ghi có</span>
            <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>khớp bằng Trace + Số tiền</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#fefce8', border: '1px solid #fde68a', fontSize: 12, fontWeight: 800, color: '#854d0e' }}>NAPAS Đến TC</span>
            <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 700 }}>→</span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#dbeafe', border: '1px solid #93c5fd', fontSize: 12, fontWeight: 800, color: '#1e40af' }}>Core Ghi nợ</span>
            <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>khớp bằng Trace + Số tiền</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid #e5e7eb', paddingLeft: 16 }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>
              <b>Ngày GD</b> = ngày NAPAS ghi nhận &nbsp;|&nbsp;
              <b>Giờ GD</b> = giờ thực tế &nbsp;|&nbsp;
              <b>QT</b> = giao dịch qua đêm từ T-1
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <DirectionToggle value={dir} onChange={d => { setDir(d); setRI(null) }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {dir === 'Đi'
            ? 'NAPAS Đi (TC + KTC) làm gốc → kiểm tra khớp với Core Ghi có'
            : 'NAPAS Đến TC làm gốc → kiểm tra khớp với Core Ghi nợ'}
        </span>
      </div>

      {/* View tab switcher */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 16 }}>
        {[
          { key: 'all',          label: 'Tất cả',     count: base.length,           color: C.primary,  badgeBg: '#eff6ff' },
          { key: 'unmatched',    label: 'Không khớp', count: unmatchedBase.length,  color: '#dc2626',  badgeBg: '#fef2f2' },
          { key: 'needs_action', label: 'Cần xử lý',  count: needsActBase.length,   color: '#d97706',  badgeBg: '#fffbeb' },
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
              {unmatchedBase.length} giao dịch NAPAS không tìm được đối ứng bên Core GL
            </div>
            <div style={{ fontSize: 11, color: '#9b1c1c', marginTop: 2 }}>
              {dir === 'Đi'
                ? 'Bao gồm các giao dịch NAPAS KTC (không thành công) và GD thành công nhưng chưa ghi nhận bên Core.'
                : 'Các giao dịch NAPAS Đến TC không có đối ứng Core — trạng thái "Core không ghi nhận", cần kiểm tra thủ công.'}
            </div>
          </div>
        </div>
      )}
      {activeView === 'needs_action' && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: radius.md, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, flexShrink: 0, color: '#d97706', fontWeight: 700 }}>!</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>
              {needsActBase.length} giao dịch chờ xử lý thủ công
            </div>
            <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
              NAPAS thất bại hoặc không khớp Core cần xác nhận hoàn tiền hoặc tra cứu với đối tác NAPAS.
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
          <Input placeholder="Tìm trace..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <Select value={filterDay} onChange={e => setFD(e.target.value)} style={{ width: 130 }}>
            <option value="">Tất cả ngày</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select value={filterKTC} onChange={e => setKTC(e.target.value)} style={{ width: 140 }}>
            <option value="">TC + KTC</option>
            <option value="TC">Chỉ TC</option>
            <option value="KTC">Chỉ KTC</option>
          </Select>
          <Select value={filterCol} onChange={e => setFC(e.target.value)} style={{ width: 280 }}>
            <option value="">Tất cả kết quả</option>
            {activeCols.map((col, i) => (
              <option key={i} value={i}>{col.label}</option>
            ))}
          </Select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th colSpan={6} style={{ background: '#fefce8', borderBottom: '1px solid #fde68a', padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#854d0e' }}>
                  NAPAS (nguồn gốc)
                </th>
                <th colSpan={2} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: coreBg, color: coreColor, borderBottom: `1px solid ${coreBorder}`, borderLeft: `2px solid ${coreAcc}` }}>
                  CORE {coreLabel} (đối chiếu)
                </th>
                <th colSpan={3} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
              </tr>
              <tr>
                <th style={th()}>#</th>
                <th style={th()}>Trace</th>
                <th style={th({ background: '#fefce8' })}>Ngày GD</th>
                <th style={th({ background: '#fefce8' })}>Ngày giờ GD</th>
                <th style={th({ background: '#fefce8' })}>Loại (GD/QT)</th>
                <th style={th({ background: '#fefce8' })}>TC / KTC</th>
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
                const bg   = i % 2 ? C.neutralBg : '#fff'
                const nBg  = bg === '#fff' ? '#fefdf0' : '#fefce8'
                const cBg  = r.core ? (bg === '#fff' ? (dir === 'Đi' ? '#f7fdf9' : '#f0f4ff') : (dir === 'Đi' ? '#f0fdf4' : '#eff6ff')) : bg
                const td   = (ex = {}) => ({ padding: '9px 12px', borderBottom: isResolving ? 'none' : `1px solid ${C.cardBorder}`, background: bg, ...ex })

                return (
                  <>
                    <tr key={r.id}>
                      <td style={td({ color: C.textMuted, fontSize: 11 })}>{(page - 1) * pageSize + i + 1}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.primary, fontWeight: 600, fontSize: 12, background: nBg })}>{r.trace}</td>
                      <td style={td({ background: nBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>
                        {r.napas?.date ?? '—'}
                      </td>
                      <td style={td({ background: nBg, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', fontFamily: 'monospace' })}>
                        {r.napas?.date && r.napas?.time ? `${r.napas.date} ${r.napas.time}` : '—'}
                      </td>
                      <td style={td({ background: nBg })}><NapasTypeTag type={r.napas?.type} /></td>
                      <td style={td({ background: nBg })}><NapasStatusCell failed={r.napas?.failed} /></td>
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
