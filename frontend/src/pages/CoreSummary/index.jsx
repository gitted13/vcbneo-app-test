import { useState, useEffect } from 'react'
import Pagination from '../../components/Pagination'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'
import { RESOLUTION_OF, CORE_COLS_DI, CORE_COLS_DEN, isT1 } from '../../data/reconcile'
import { KpiBar, ResolveRow, SwiftStatusCell, NapasStatusCell, NapasTypeTag, StatusBadge, Dash } from '../../components/ReconShared'
import { api } from '../../api/client'

/* Ghi có → GD Đi (Swift Đi + NAPAS Đi)  |  Ghi nợ → GD Đến (Swift Đến + NAPAS Đến) */
const ENTRY_OPTIONS = [
  { value: 'Ghi có', dir: 'Đi',  color: '#166534', bg: '#dcfce7', border: '#86efac', acc: '#86efac' },
  { value: 'Ghi nợ', dir: 'Đến', color: '#1e40af', bg: '#dbeafe', border: '#93c5fd', acc: '#93c5fd' },
]

function EntryToggle({ value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: C.neutralBg, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 3, gap: 2 }}>
      {ENTRY_OPTIONS.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700, transition: 'all 0.12s',
              background: active ? opt.bg : 'transparent',
              color: active ? opt.color : C.textMuted,
              boxShadow: active ? `0 0 0 1.5px ${opt.border}` : 'none',
            }}
          >
            {opt.value}
          </button>
        )
      })}
    </div>
  )
}

export default function CoreSummary() {
  const { user } = useAuth()
  const { toast } = useApp()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [entry, setEntry]     = useState('Ghi có')
  const [search, setSearch]   = useState('')
  const [filterCol, setFS]    = useState('')
  const [activeView, setView] = useState('all')
  const [resolvingId, setRI]  = useState(null)
  const [noteInput, setNote]  = useState('')
  const [page, setPage]       = useState(1)
  const [pageSize, setPS]     = useState(30)
  const [activeKpi, setKpi]   = useState(null)
  const [filterDay, setFD]    = useState('')

  useEffect(() => {
    api.getRows()
      .then(res => setRows(res.rows ?? []))
      .catch(() => toast('Không thể tải dữ liệu từ server.', 'error'))
      .finally(() => setLoading(false))
  }, [])

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

  const opt = ENTRY_OPTIONS.find(o => o.value === entry) ?? ENTRY_OPTIONS[0]
  const dir = opt.dir
  const activeCols = entry === 'Ghi có' ? CORE_COLS_DI : CORE_COLS_DEN

  const KPI_FN = {
    khop:      r => r.recon_status === 'KHOP',
    lech:      r => r.recon_status === 'KHOP_LECH_NGAY',
    timeout:   r => r.recon_status === 'TIMEOUT_CO_CORE',
    that_bai:  r => r.recon_status === 'SWIFT_THAT_BAI',
    chi_swift: r => r.recon_status === 'CHI_SWIFT',
  }

  const needsAction   = (r) => RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by
  const base          = rows.filter(r => r.direction === dir && r.core)
  const days          = [...new Set(base.map(r => r.day))].filter(Boolean).sort()
  const unmatchedBase = base.filter(r => !r.swift || !r.napas)
  const needsActBase  = base.filter(r => needsAction(r))
  const viewBase      = activeView === 'unmatched'    ? unmatchedBase
                      : activeView === 'needs_action' ? needsActBase
                      : base

  const filtered = viewBase.filter(r => {
    if (filterDay && r.day !== filterDay) return false
    if (search && !r.trace.includes(search) && !(r.sequence ?? '').includes(search)) return false
    if (activeView === 'all') {
      if (activeKpi && KPI_FN[activeKpi] && !KPI_FN[activeKpi](r)) return false
      if (filterCol === 'NEEDS_ACTION' && !needsAction(r)) return false
      else if (filterCol && filterCol !== 'NEEDS_ACTION') {
        const idx = parseInt(filterCol)
        if (!activeCols[idx]?.filterFn(r)) return false
      }
    }
    return true
  })
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1); setFS(''); setFD(''); setKpi(null); setView('all') }, [entry])
  useEffect(() => { setPage(1) }, [filterCol, activeKpi, search, activeView])

  /* KPI per spec */
  let kpiItems
  if (entry === 'Ghi có') {
    const khop      = base.filter(r => r.recon_status === 'KHOP')
    const lech      = base.filter(r => r.recon_status === 'KHOP_LECH_NGAY')
    const timeout   = base.filter(r => r.recon_status === 'TIMEOUT_CO_CORE')
    const thatBai   = rows.filter(r => r.direction === dir && r.recon_status === 'SWIFT_THAT_BAI' && !r.napas)
    kpiItems = [
      { label: 'Tổng Ghi có',          val: base.length,    color: opt.color, bg: opt.bg,    border: opt.border },
      { label: 'Core ngày T – Swift ngày T',                      val: khop.length,    color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', onClick: () => toggleKpi('khop'),     isActive: activeKpi === 'khop' },
      { label: 'Core ngày T – Swift ngày T-1',                   val: lech.length,    color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', onClick: () => toggleKpi('lech'),     isActive: activeKpi === 'lech' },
      { label: 'Timeout – Core ghi nhận',                        val: timeout.length, color: '#d97706', bg: '#fffbeb', border: '#fde68a', onClick: () => toggleKpi('timeout'),  isActive: activeKpi === 'timeout' },
      { label: 'Thất bại – trace không phát sinh bên NAPAS',     val: thatBai.length, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', onClick: () => toggleKpi('that_bai'), isActive: activeKpi === 'that_bai' },
    ]
  } else {
    const khop  = base.filter(r => r.recon_status === 'KHOP')
    const lech  = base.filter(r => r.recon_status === 'KHOP_LECH_NGAY')
    const chiSw = rows.filter(r => r.direction === dir && r.recon_status === 'CHI_SWIFT')
    kpiItems = [
      { label: 'Tổng Ghi nợ',         val: base.length,  color: opt.color, bg: opt.bg,    border: opt.border },
      { label: 'Core ngày T – NAPAS ngày T',   val: khop.length,  color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', onClick: () => toggleKpi('khop'),      isActive: activeKpi === 'khop' },
      { label: 'Core ngày T – NAPAS ngày T-1', val: lech.length,  color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', onClick: () => toggleKpi('lech'),      isActive: activeKpi === 'lech' },
      { label: 'Chỉ Swift',                    val: chiSw.length, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', onClick: () => toggleKpi('chi_swift'), isActive: activeKpi === 'chi_swift' },
    ]
  }

  const th = (extra = {}) => ({
    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`,
    textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', ...extra,
  })
  const COLS = 12

  if (loading) return <PageShell title="Đối chiếu Core GL – Tổng hợp"><div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Đang tải dữ liệu...</div></PageShell>

  return (
    <PageShell
      title="Đối chiếu Core GL – Tổng hợp"
      subtitle="Core GL làm nguồn gốc — đối chiếu đồng thời với Swift và NAPAS (1 Core ↔ 2 nguồn)."
    >
      {/* Data flow banner */}
      <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f8fafc', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Luồng đối chiếu (1 Core ↔ 2 nguồn)</div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#dcfce7', border: '1px solid #86efac', fontSize: 12, fontWeight: 800, color: '#166534' }}>Core Ghi có</span>
            <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 700 }}>↔</span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 800, color: '#1d4ed8' }}>Swift Đi</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>+</span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#fefce8', border: '1px solid #fde68a', fontSize: 12, fontWeight: 800, color: '#854d0e' }}>NAPAS Đi</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#dbeafe', border: '1px solid #93c5fd', fontSize: 12, fontWeight: 800, color: '#1e40af' }}>Core Ghi nợ</span>
            <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 700 }}>↔</span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: 12, fontWeight: 800, color: '#7c3aed' }}>Swift Đến</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>+</span>
            <span style={{ padding: '4px 10px', borderRadius: 6, background: '#fefce8', border: '1px solid #fde68a', fontSize: 12, fontWeight: 800, color: '#854d0e' }}>NAPAS Đến</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <EntryToggle value={entry} onChange={e => { setEntry(e); setRI(null) }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {entry === 'Ghi có'
            ? 'Core Ghi có làm gốc → đối chiếu Swift Đi + NAPAS Đi'
            : 'Core Ghi nợ làm gốc → đối chiếu Swift Đến + NAPAS Đến'}
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
              {unmatchedBase.length} giao dịch Core thiếu đối ứng từ ít nhất một nguồn ({entry === 'Ghi có' ? 'Swift Đi hoặc NAPAS Đi' : 'Swift Đến hoặc NAPAS Đến'})
            </div>
            <div style={{ fontSize: 11, color: '#9b1c1c', marginTop: 2 }}>
              Core ghi nhận giao dịch nhưng một hoặc cả hai bên đối chiếu không có dữ liệu tương ứng — cần điều tra nguyên nhân.
            </div>
          </div>
        </div>
      )}
      {activeView === 'needs_action' && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: radius.md, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, flexShrink: 0, color: '#d97706', fontWeight: 700 }}>!</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706' }}>
              {needsActBase.length} giao dịch cần xử lý thủ công
            </div>
            <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
              Gồm timeout có Core, không khớp và ngoại lệ chưa được xác nhận. Cần review và ghi chú giải quyết.
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, flexWrap: 'wrap', background: C.neutralBg }}>
          <Input placeholder="Tìm trace, sequence..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <Select value={filterDay} onChange={e => setFD(e.target.value)} style={{ width: 130 }}>
            <option value="">Tất cả ngày</option>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select value={filterCol} onChange={e => setFS(e.target.value)} style={{ width: 280 }}>
            <option value="">Tất cả GD</option>
            <option value="NEEDS_ACTION">Cần xử lý</option>
            {activeCols.filter(col => !col.hidden).map((col, i) => (
              <option key={i} value={i}>{col.label}</option>
            ))}
          </Select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th colSpan={5} style={{ background: opt.bg, borderBottom: `1px solid ${opt.border}`, padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: opt.color }}>
                  CORE {entry.toUpperCase()} (nguồn gốc)
                </th>
                <th colSpan={2} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: '#dbeafe', color: '#1e40af', borderBottom: '1px solid #bfdbfe', borderLeft: '2px solid #93c5fd' }}>SWIFT</th>
                <th colSpan={3} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: '#fef9c3', color: '#854d0e', borderBottom: '1px solid #fde68a', borderLeft: '2px solid #fcd34d' }}>NAPAS</th>
                <th colSpan={2} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
              </tr>
              <tr>
                <th style={th()}>#</th>
                <th style={th()}>Trace</th>
                <th style={th()}>Sequence</th>
                <th style={th({ background: opt.bg })}>Ngày Core</th>
                <th style={th()}>Số tiền</th>
                <th style={th({ borderLeft: '2px solid #93c5fd', background: '#eff6ff' })}>Ngày Swift</th>
                <th style={th({ background: '#eff6ff' })}>TT Swift</th>
                <th style={th({ borderLeft: '2px solid #fcd34d', background: '#fefce8' })}>Ngày NAPAS</th>
                <th style={th({ background: '#fefce8' })}>Loại</th>
                <th style={th({ background: '#fefce8' })}>TC/KTC</th>
                <th style={th()}>Kết quả</th>
                <th style={th()}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => {
                const isResolving = resolvingId === r.id
                const res   = RESOLUTION_OF[r.recon_status]
                const bg    = i % 2 ? C.neutralBg : '#fff'
                const rowBg = isResolving ? '#fffbeb' : bg
                const corBg = bg === '#fff' ? (entry === 'Ghi có' ? '#f7fdf9' : '#f0f4ff') : (entry === 'Ghi có' ? '#f0fdf4' : '#eff6ff')
                const sBg   = r.swift ? (bg === '#fff' ? '#f8fbff' : '#f2f8ff') : rowBg
                const nBg   = r.napas ? (bg === '#fff' ? '#fefdf0' : '#fefce8') : rowBg
                const td    = (ex = {}) => ({ padding: '9px 12px', borderBottom: isResolving ? 'none' : `1px solid ${C.cardBorder}`, background: rowBg, ...ex })

                return (
                  <>
                    <tr key={r.id}>
                      <td style={td({ color: C.textMuted, fontSize: 11 })}>{(page - 1) * pageSize + i + 1}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.primary, fontWeight: 600, fontSize: 12 })}>{r.trace}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.textMuted, fontSize: 11 })}>{r.sequence ?? '—'}</td>
                      <td style={td({ background: corBg, fontSize: 12, color: C.textMuted, fontWeight: 600 })}>{r.core?.date ?? '—'}</td>
                      <td style={td({ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' })}>{r.amount.toLocaleString('vi-VN')} ₫</td>
                      <td style={td({ borderLeft: '2px solid #93c5fd', background: sBg, fontSize: 12, color: C.textMuted })}>{r.swift?.date ?? '—'}</td>
                      <td style={td({ background: sBg })}>{r.swift ? <SwiftStatusCell status={r.swift?.status} /> : <Dash />}</td>
                      <td style={td({ borderLeft: '2px solid #fcd34d', background: nBg, fontSize: 12, color: C.textMuted })}>
                        {r.napas ? (
                          <div>
                            <div>{r.napas.date}</div>
                            {r.napas.time && <div style={{ fontSize: 10, color: '#9ca3af' }}>{r.napas.time}</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td style={td({ background: nBg })}>{r.napas ? <NapasTypeTag type={r.napas.type} /> : <Dash />}</td>
                      <td style={td({ background: nBg })}>{r.napas ? <NapasStatusCell failed={r.napas.failed} /> : <Dash />}</td>
                      <td style={td()}>{(() => { const c = activeCols.find(col => col.filterFn(r)); return c ? <span style={{ padding:'3px 8px', borderRadius:4, fontSize:11, fontWeight:700, background:c.bg, color:c.color, border:`1px solid ${c.border}`, whiteSpace:'nowrap' }}>{c.label}</span> : <StatusBadge status={r.recon_status} /> })()}</td>
                      <td style={td({ whiteSpace: 'nowrap' })}>
                        {r.resolved_by
                          ? <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ {r.resolved_by}</span>
                          : res?.needsAction && canResolve
                          ? <Button size="sm" variant="ghost" onClick={() => { setRI(r.id); setNote('') }}>Xử lý</Button>
                          : res
                          ? <span style={{ fontSize: 12, color: res.color, fontWeight: 600 }}>{res.label}</span>
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
        <Pagination total={filtered.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPS} />
      </div>
    </PageShell>
  )
}
