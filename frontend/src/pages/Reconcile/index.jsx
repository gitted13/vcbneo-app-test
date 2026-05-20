import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Input, Select, FormRow } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'
import { RECON_STATUS_META, RESOLUTION_OF, INITIAL_ROWS, LAST_SYNC_INFO } from '../../data/reconcile'
import { LastSyncBanner } from '../../components/ReconShared'

/* ── Chip components ───────────────────────────────────────────────────────── */
function SourceChip({ label, color, bg }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 800,
      color, background: bg, letterSpacing: 0.4,
    }}>{label}</span>
  )
}

/* ── NavItem ───────────────────────────────────────────────────────────────── */
function NavItem({ src, dst, desc, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '10px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        borderRadius: 8, marginBottom: 4,
        background: active ? '#eff6ff' : 'transparent',
        borderLeft: active ? `3px solid ${C.primary}` : '3px solid transparent',
        transition: 'all 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 3 }}>
        <SourceChip {...src} />
        {dst && dst.length > 0 && (
          <>
            <span style={{ fontSize: 10, color: C.textMuted }}>↓</span>
            {dst.map((d, i) => <SourceChip key={i} {...d} />)}
          </>
        )}
      </div>
      {desc && <div style={{ fontSize: 11, color: active ? C.primary : C.textMuted, fontWeight: active ? 600 : 400, lineHeight: 1.3 }}>{desc}</div>}
    </button>
  )
}

/* ── Sidebar group label ───────────────────────────────────────────────────── */
function NavGroupLabel({ label }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, padding: '10px 12px 4px', letterSpacing: 0.8, textTransform: 'uppercase' }}>
      {label}
    </div>
  )
}

/* ── DirectionToggle ───────────────────────────────────────────────────────── */
function DirectionToggle({ value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.cardBorder}` }}>
      {[['Đi', '→ Giao dịch Đi'], ['Đến', '← Giao dịch Đến']].map(([val, label]) => (
        <button key={val} onClick={() => onChange(val)} style={{
          padding: '7px 20px', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: value === val ? 700 : 500, fontFamily: 'inherit',
          background: value === val ? C.primary : '#fff',
          color: value === val ? '#fff' : C.textMuted,
          transition: 'all 0.12s',
        }}>{label}</button>
      ))}
    </div>
  )
}

/* ── Status / cell helpers ─────────────────────────────────────────────────── */
function SwiftStatusCell({ status }) {
  if (!status) return <Dash />
  const map = {
    THANH_CONG: { dot: '#059669', label: 'Thành công' },
    TIMEOUT:    { dot: '#d97706', label: 'Timeout'    },
    THAT_BAI:   { dot: '#dc2626', label: 'Thất bại'   },
  }
  const m = map[status] ?? { dot: C.textMuted, label: status }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      <span style={{ color: m.dot, fontWeight: 600 }}>{m.label}</span>
    </span>
  )
}

function NapasStatusCell({ failed }) {
  if (failed == null) return <Dash />
  return failed
    ? <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>✕ KTC</span>
    : <span style={{ fontSize: 11, color: '#059669' }}>✓ TC</span>
}

function NapasTypeTag({ type }) {
  if (!type) return null
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700,
      background: type === 'QT' ? '#fef9c3' : '#f0fdf4',
      color:      type === 'QT' ? '#854d0e' : '#166534',
      border: `1px solid ${type === 'QT' ? '#fde68a' : '#bbf7d0'}`,
    }}>{type}</span>
  )
}

function StatusBadge({ status }) {
  const m = RECON_STATUS_META[status]
  if (!m) return <span style={{ color: C.textMuted }}>{status}</span>
  return (
    <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: m.bg, color: m.color, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

function Dash() { return <span style={{ color: C.textLight }}>—</span> }

/* ── KpiBar ────────────────────────────────────────────────────────────────── */
function KpiBar({ items }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      {items.map(s => {
        const active = s.isActive
        return (
          <div key={s.label}
            onClick={s.onClick}
            title={s.onClick ? (active ? 'Nhấn để bỏ lọc' : 'Nhấn để lọc') : undefined}
            style={{
              flex: 1, textAlign: 'center', borderRadius: radius.md, padding: '14px 16px',
              background: active ? s.color : s.bg,
              border: `1.5px solid ${active ? s.color : s.border}`,
              boxShadow: active ? '0 2px 8px rgba(0,0,0,0.18)' : shadow.sm,
              cursor: s.onClick ? 'pointer' : 'default',
              transition: 'all 0.15s', userSelect: 'none',
              transform: active ? 'translateY(-1px)' : 'none',
            }}>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color: active ? '#fff' : s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: active ? 'rgba(255,255,255,0.85)' : C.textMuted }}>{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ── ResolveRow ────────────────────────────────────────────────────────────── */
function ResolveRow({ cols, rowId, noteInput, setNote, onConfirm, onCancel }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '10px 14px', background: '#fffbeb', borderBottom: `1px solid ${C.cardBorder}`, borderLeft: `3px solid ${C.warning}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>Ghi chú xử lý:</span>
          <Input value={noteInput} onChange={e => setNote(e.target.value)} placeholder="Nhập lý do, ghi chú..." style={{ flex: 1 }} autoFocus />
          <Button size="sm" onClick={onConfirm}>Xác nhận</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Hủy</Button>
        </div>
      </td>
    </tr>
  )
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
export default function Reconcile() {
  const { user } = useAuth()
  const { toast } = useApp()
  const [activeTab, setActiveTab] = useState(0)
  const [rows, setRows]           = useState(INITIAL_ROWS)

  const onResolve = (rowId, noteInput) => {
    const row = rows.find(r => r.id === rowId)
    setRows(prev => prev.map(r => r.id === rowId
      ? { ...r, resolved_by: user?.username ?? user?.name ?? 'user', resolved_at: new Date().toLocaleString('vi-VN'), note: noteInput }
      : r
    ))
    toast(`Đã xử lý giao dịch ${row?.trace}.`, 'success')
  }

  const navItems = [
    {
      group: 'ĐỐI CHIẾU',
      items: [
        {
          tab: 0,
          src: { label: 'SWIFT', color: '#1d4ed8', bg: '#dbeafe' },
          dst: [{ label: 'CORE', color: '#166534', bg: '#dcfce7' }],
          desc: 'Swift làm gốc',
        },
        {
          tab: 1,
          src: { label: 'NAPAS', color: '#854d0e', bg: '#fef9c3' },
          dst: [{ label: 'CORE', color: '#166534', bg: '#dcfce7' }],
          desc: 'NAPAS làm gốc',
        },
        {
          tab: 2,
          src: { label: 'CORE', color: '#166534', bg: '#dcfce7' },
          dst: [
            { label: 'SWIFT', color: '#1d4ed8', bg: '#dbeafe' },
            { label: 'NAPAS', color: '#854d0e', bg: '#fef9c3' },
          ],
          desc: 'Tổng hợp 3 chiều',
        },
      ],
    },
    {
      group: 'CÀI ĐẶT',
      items: [
        {
          tab: 3,
          src: { label: 'QUY TẮC', color: '#6d28d9', bg: '#ede9fe' },
          dst: [],
          desc: 'Quy tắc phân loại',
        },
      ],
    },
  ]

  return (
    <PageShell title="Đối soát" subtitle="So khớp 3 chiều: Swift ↔ Core · NAPAS ↔ Core · Core ↔ Swift + NAPAS. Chọn chiều Đi hoặc Đến trong từng giao diện.">
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Left nav */}
        <nav style={{ width: 200, flexShrink: 0, paddingRight: 16, borderRight: `1px solid ${C.cardBorder}` }}>
          {navItems.map(group => (
            <div key={group.group}>
              <NavGroupLabel label={group.group} />
              {group.items.map(item => (
                <NavItem
                  key={item.tab}
                  src={item.src}
                  dst={item.dst}
                  desc={item.desc}
                  active={activeTab === item.tab}
                  onClick={() => setActiveTab(item.tab)}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Content */}
        <div style={{ flex: 1, paddingLeft: 24, minWidth: 0 }}>
          {activeTab === 0 && <SwiftCoreTab  user={user} rows={rows} onResolve={onResolve} />}
          {activeTab === 1 && <NapasCoreTab  user={user} rows={rows} onResolve={onResolve} />}
          {activeTab === 2 && <CoreMasterTab user={user} rows={rows} onResolve={onResolve} />}
          {activeTab === 3 && <DateRulesTab  user={user} />}
        </div>
      </div>
    </PageShell>
  )
}

/* ── SwiftCoreTab ──────────────────────────────────────────────────────────── */
function SwiftCoreTab({ user, rows, onResolve }) {
  const canResolve = user?.role === 'Admin' || user?.role === 'Operator'
  const [dir, setDir]           = useState('Đi')
  const [search, setSearch]     = useState('')
  const [filterStatus, setFS]   = useState('')
  const [activeKpi, setKpi]     = useState(null)
  const [resolvingId, setRI]    = useState(null)
  const [noteInput, setNote]    = useState('')
  const toggleKpi = key => setKpi(prev => prev === key ? null : key)

  const base     = rows.filter(r => r.swift && r.direction === dir)
  const filtered = base.filter(r => {
    if (activeKpi === 'matched'   && r.core == null) return false
    if (activeKpi === 'unmatched' && r.core != null) return false
    if (activeKpi === 'needsAct'  && !(RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by)) return false
    if (filterStatus && r.recon_status !== filterStatus) return false
    if (search && !r.trace.includes(search) && !(r.sequence ?? '').includes(search)) return false
    return true
  })

  const matched    = base.filter(r => r.core != null).length
  const unmatched  = base.filter(r => r.core == null).length
  const needsAct   = base.filter(r => RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by).length

  const th = (extra = {}) => ({
    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`,
    textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', ...extra,
  })
  const COLS = 12

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <DirectionToggle value={dir} onChange={d => { setDir(d); setRI(null); setKpi(null) }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {dir === 'Đi'
            ? 'Swift Đi làm gốc → kiểm tra khớp với Core Ghi có'
            : 'Swift Đến làm gốc → kiểm tra khớp với Core Ghi nợ'}
        </span>
      </div>

      <LastSyncBanner info={LAST_SYNC_INFO} />

      <KpiBar items={[
        { label: `Swift ${dir}`, val: base.length, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', onClick: () => setKpi(null),          isActive: false },
        { label: 'Khớp Core',    val: matched,     color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', onClick: () => toggleKpi('matched'),   isActive: activeKpi === 'matched' },
        { label: 'Chưa khớp',   val: unmatched,   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', onClick: () => toggleKpi('unmatched'), isActive: activeKpi === 'unmatched' },
        { label: 'Cần xử lý',   val: needsAct,    color: '#d97706', bg: '#fffbeb', border: '#fde68a', onClick: () => toggleKpi('needsAct'),  isActive: activeKpi === 'needsAct' },
      ]} />

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
          <Input placeholder="Tìm trace, sequence..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <Select value={filterStatus} onChange={e => setFS(e.target.value)} style={{ width: 210 }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(RECON_STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </Select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th colSpan={7} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
                <th colSpan={2} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: '#dcfce7', color: '#166534', borderBottom: '1px solid #bbf7d0', borderLeft: '2px solid #86efac' }}>
                  CORE {dir === 'Đi' ? 'GHI CÓ' : 'GHI NỢ'}
                </th>
                <th colSpan={3} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
              </tr>
              <tr>
                <th style={th()}>#</th>
                <th style={th()}>Trace</th>
                <th style={th()}>Sequence</th>
                <th style={th({ background: '#eff6ff' })}>Ngày GD (thực tế)</th>
                <th style={th({ background: '#eff6ff' })}>Ngày GN (ghi nhận)</th>
                <th style={th({ background: '#eff6ff' })}>TT Swift</th>
                <th style={th()}>Số tiền</th>
                <th style={th({ borderLeft: '2px solid #86efac', background: '#f0fdf4' })}>Ngày Core</th>
                <th style={th({ background: '#f0fdf4' })}>Loại ghi</th>
                <th style={th()}>Kết quả khớp</th>
                <th style={th()}>Hướng xử lý</th>
                <th style={th()}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isResolving = resolvingId === r.id
                const res  = RESOLUTION_OF[r.recon_status]
                const t1   = r.swift?.txnDate !== r.swift?.date
                const bg   = i % 2 ? C.neutralBg : '#fff'
                const cBg  = r.core ? (bg === '#fff' ? '#f7fdf9' : '#f0fdf4') : bg
                const sBg  = bg === '#fff' ? '#f8fbff' : '#f2f8ff'
                const td   = (ex = {}) => ({ padding: '9px 12px', borderBottom: isResolving ? 'none' : `1px solid ${C.cardBorder}`, background: bg, ...ex })

                return (
                  <>
                    <tr key={r.id}>
                      <td style={td({ color: C.textMuted, fontSize: 11 })}>{i + 1}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.primary, fontWeight: 600, fontSize: 12 })}>{r.trace}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.textMuted, fontSize: 11 })}>{r.sequence ?? '—'}</td>
                      <td style={td({ background: sBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>{r.swift?.txnDate ?? '—'}</td>
                      <td style={td({ background: sBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>
                        {r.swift?.date ?? '—'}
                        {t1 && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#0891b2', background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 3, padding: '1px 4px' }}>T+1</span>}
                      </td>
                      <td style={td({ background: sBg })}><SwiftStatusCell status={r.swift?.status} /></td>
                      <td style={td({ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 })}>{r.amount.toLocaleString('vi-VN')} ₫</td>
                      <td style={td({ borderLeft: '2px solid #86efac', background: cBg, fontSize: 12, color: C.textMuted })}>{r.core?.date ?? '—'}</td>
                      <td style={td({ background: cBg })}>
                        {r.core?.entry
                          ? <span style={{ fontSize: 12, fontWeight: 600, color: r.core.entry === 'Ghi có' ? '#059669' : '#2563eb' }}>{r.core.entry}</span>
                          : <Dash />}
                      </td>
                      <td style={td()}><StatusBadge status={r.recon_status} /></td>
                      <td style={td({ whiteSpace: 'nowrap' })}>
                        {r.resolved_by
                          ? <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Đã xử lý</span>
                          : res ? <span style={{ fontSize: 12, color: res.color, fontWeight: 600 }}>{res.label}</span> : null}
                      </td>
                      <td style={td({ whiteSpace: 'nowrap' })}>
                        {r.resolved_by
                          ? <span style={{ fontSize: 11, color: C.textMuted }}>{r.resolved_by} · {r.resolved_at}</span>
                          : res?.needsAction && canResolve
                          ? <Button size="sm" variant="ghost" onClick={() => { setRI(r.id); setNote('') }}>Xử lý</Button>
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
                      <ResolveRow cols={COLS} rowId={r.id} noteInput={noteInput} setNote={setNote}
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
        <div style={{ padding: '10px 16px', fontSize: 12, color: C.textMuted, borderTop: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-between' }}>
          <span>Hiển thị <b>{filtered.length}</b> / {base.length} giao dịch Swift {dir}</span>
          <Button size="sm" variant="ghost">Xuất CSV</Button>
        </div>
      </div>
    </>
  )
}

/* ── NapasCoreTab ──────────────────────────────────────────────────────────── */
function NapasCoreTab({ user, rows, onResolve }) {
  const canResolve = user?.role === 'Admin' || user?.role === 'Operator'
  const [dir, setDir]         = useState('Đi')
  const [search, setSearch]   = useState('')
  const [filterStatus, setFS] = useState('')
  const [filterKTC, setKTC]   = useState('')
  const [activeKpi, setKpi]   = useState(null)
  const [resolvingId, setRI]  = useState(null)
  const [noteInput, setNote]  = useState('')
  const toggleKpi = key => setKpi(prev => prev === key ? null : key)

  const base = rows.filter(r => r.napas && r.direction === dir)
  const filtered = base.filter(r => {
    if (activeKpi === 'tc'       &&  r.napas.failed) return false
    if (activeKpi === 'ktc'      && !r.napas.failed) return false
    if (activeKpi === 'matched'  && r.core == null) return false
    if (activeKpi === 'needsAct' && !(RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by)) return false
    if (filterStatus && r.recon_status !== filterStatus) return false
    if (filterKTC === 'TC'  &&  r.napas.failed) return false
    if (filterKTC === 'KTC' && !r.napas.failed) return false
    if (search && !r.trace.includes(search) && !(r.sequence ?? '').includes(search)) return false
    return true
  })

  const tcCount  = base.filter(r => !r.napas.failed).length
  const ktcCount = base.filter(r =>  r.napas.failed).length
  const matched  = base.filter(r => r.core != null).length
  const needsAct = base.filter(r => RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by).length

  const th = (extra = {}) => ({
    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`,
    textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', ...extra,
  })
  const COLS = 12

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <DirectionToggle value={dir} onChange={d => { setDir(d); setRI(null); setKpi(null) }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {dir === 'Đi'
            ? 'NAPAS Đi (TC + KTC) làm gốc → kiểm tra khớp với Core Ghi có'
            : 'NAPAS Đến TC làm gốc → kiểm tra khớp với Core Ghi nợ'}
        </span>
      </div>

      <LastSyncBanner info={LAST_SYNC_INFO} />

      <KpiBar items={[
        { label: `NAPAS ${dir}`,    val: base.length, color: '#d97706', bg: '#fffbeb', border: '#fde68a', onClick: () => setKpi(null),        isActive: false },
        { label: 'Thành công',      val: tcCount,     color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', onClick: () => toggleKpi('tc'),      isActive: activeKpi === 'tc' },
        { label: 'Không thành công', val: ktcCount,   color: '#dc2626', bg: '#fef2f2', border: '#fecaca', onClick: () => toggleKpi('ktc'),     isActive: activeKpi === 'ktc' },
        { label: 'Khớp Core',       val: matched,     color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', onClick: () => toggleKpi('matched'), isActive: activeKpi === 'matched' },
        { label: 'Cần xử lý',       val: needsAct,   color: '#d97706', bg: '#fffbeb', border: '#fde68a', onClick: () => toggleKpi('needsAct'), isActive: activeKpi === 'needsAct' },
      ]} />

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
          <Input placeholder="Tìm trace, sequence..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <Select value={filterKTC} onChange={e => setKTC(e.target.value)} style={{ width: 150 }}>
            <option value="">TC + KTC</option>
            <option value="TC">Chỉ TC</option>
            <option value="KTC">Chỉ KTC</option>
          </Select>
          <Select value={filterStatus} onChange={e => setFS(e.target.value)} style={{ width: 210 }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(RECON_STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </Select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th colSpan={7} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
                <th colSpan={2} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: '#dcfce7', color: '#166534', borderBottom: '1px solid #bbf7d0', borderLeft: '2px solid #86efac' }}>
                  CORE {dir === 'Đi' ? 'GHI CÓ' : 'GHI NỢ'}
                </th>
                <th colSpan={3} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
              </tr>
              <tr>
                <th style={th()}>#</th>
                <th style={th()}>Trace</th>
                <th style={th({ background: '#fefce8' })}>Ngày GD</th>
                <th style={th({ background: '#fefce8' })}>Ngày giờ GD</th>
                <th style={th({ background: '#fefce8' })}>Loại</th>
                <th style={th({ background: '#fefce8' })}>TC / KTC</th>
                <th style={th()}>Số tiền</th>
                <th style={th({ borderLeft: '2px solid #86efac', background: '#f0fdf4' })}>Ngày Core</th>
                <th style={th({ background: '#f0fdf4' })}>Loại ghi</th>
                <th style={th()}>Kết quả khớp</th>
                <th style={th()}>Hướng xử lý</th>
                <th style={th()}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isResolving = resolvingId === r.id
                const res  = RESOLUTION_OF[r.recon_status]
                const bg   = i % 2 ? C.neutralBg : '#fff'
                const nBg  = bg === '#fff' ? '#fefdf0' : '#fefce8'
                const cBg  = r.core ? (bg === '#fff' ? '#f7fdf9' : '#f0fdf4') : bg
                const td   = (ex = {}) => ({ padding: '9px 12px', borderBottom: isResolving ? 'none' : `1px solid ${C.cardBorder}`, background: bg, ...ex })

                return (
                  <>
                    <tr key={r.id}>
                      <td style={td({ color: C.textMuted, fontSize: 11 })}>{i + 1}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.primary, fontWeight: 600, fontSize: 12 })}>{r.trace}</td>
                      <td style={td({ background: nBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>{r.napas?.date ?? '—'}</td>
                      <td style={td({ background: nBg, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', fontFamily: 'monospace' })}>
                        {r.napas?.date && r.napas?.time ? `${r.napas.date} ${r.napas.time}` : '—'}
                      </td>
                      <td style={td({ background: nBg })}><NapasTypeTag type={r.napas?.type} /></td>
                      <td style={td({ background: nBg })}><NapasStatusCell failed={r.napas?.failed} /></td>
                      <td style={td({ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 })}>{r.amount.toLocaleString('vi-VN')} ₫</td>
                      <td style={td({ borderLeft: '2px solid #86efac', background: cBg, fontSize: 12, color: C.textMuted })}>{r.core?.date ?? '—'}</td>
                      <td style={td({ background: cBg })}>
                        {r.core?.entry
                          ? <span style={{ fontSize: 12, fontWeight: 600, color: r.core.entry === 'Ghi có' ? '#059669' : '#2563eb' }}>{r.core.entry}</span>
                          : <Dash />}
                      </td>
                      <td style={td()}><StatusBadge status={r.recon_status} /></td>
                      <td style={td({ whiteSpace: 'nowrap' })}>
                        {r.resolved_by
                          ? <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Đã xử lý</span>
                          : res ? <span style={{ fontSize: 12, color: res.color, fontWeight: 600 }}>{res.label}</span> : null}
                      </td>
                      <td style={td({ whiteSpace: 'nowrap' })}>
                        {r.resolved_by
                          ? <span style={{ fontSize: 11, color: C.textMuted }}>{r.resolved_by} · {r.resolved_at}</span>
                          : res?.needsAction && canResolve
                          ? <Button size="sm" variant="ghost" onClick={() => { setRI(r.id); setNote('') }}>Xử lý</Button>
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
                      <ResolveRow cols={COLS} rowId={r.id} noteInput={noteInput} setNote={setNote}
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
        <div style={{ padding: '10px 16px', fontSize: 12, color: C.textMuted, borderTop: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-between' }}>
          <span>Hiển thị <b>{filtered.length}</b> / {base.length} giao dịch NAPAS {dir}</span>
          <Button size="sm" variant="ghost">Xuất CSV</Button>
        </div>
      </div>
    </>
  )
}

/* ── CoreMasterTab ─────────────────────────────────────────────────────────── */
function CoreMasterTab({ user, rows, onResolve }) {
  const canResolve = user?.role === 'Admin' || user?.role === 'Operator'
  const [dir, setDir]           = useState('Đi')
  const [search, setSearch]     = useState('')
  const [filterStatus, setFS]   = useState('NEEDS_ACTION')
  const [activeKpi, setKpi]     = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [resolvingId, setRI]    = useState(null)
  const [noteInput, setNote]    = useState('')
  const toggleKpi = key => setKpi(prev => prev === key ? null : key)

  const needsAction = (r) => RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by

  const base = rows.filter(r => r.direction === dir)
  const filtered = base.filter(r => {
    if (activeKpi === 'khop'     && r.recon_status !== 'KHOP') return false
    if (activeKpi === 'lech'     && r.recon_status !== 'KHOP_LECH_NGAY') return false
    if (activeKpi === 'needsAct' && !needsAction(r)) return false
    if (activeKpi === 'done'     && !(RESOLUTION_OF[r.recon_status]?.needsAction && r.resolved_by)) return false
    if (filterStatus === 'NEEDS_ACTION' && !needsAction(r)) return false
    else if (filterStatus && filterStatus !== 'NEEDS_ACTION' && r.recon_status !== filterStatus) return false
    if (dateFrom || dateTo) {
      const ref = r.core?.date ?? r.swift?.date ?? r.napas?.date ?? ''
      const [d, m, y] = ref.split('/')
      const iso = y && m && d ? `${y}${m}${d}` : ''
      if (dateFrom && iso < dateFrom.replace(/-/g, '')) return false
      if (dateTo   && iso > dateTo.replace(/-/g, ''))   return false
    }
    if (search && !r.trace.includes(search) && !(r.sequence ?? '').includes(search)) return false
    return true
  })

  const totalKhop  = base.filter(r => r.recon_status === 'KHOP').length
  const totalLech  = base.filter(r => r.recon_status === 'KHOP_LECH_NGAY').length
  const totalNeeds = base.filter(needsAction).length
  const totalDone  = base.filter(r => RESOLUTION_OF[r.recon_status]?.needsAction && r.resolved_by).length

  const th = (extra = {}) => ({
    padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`,
    textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', ...extra,
  })
  const COLS = 15

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <DirectionToggle value={dir} onChange={d => { setDir(d); setRI(null); setFS('NEEDS_ACTION'); setKpi(null) }} />
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {dir === 'Đi'
            ? 'Tổng hợp Đi: Core Ghi có đối chiếu Swift Đi + NAPAS Đi'
            : 'Tổng hợp Đến: Core Ghi nợ đối chiếu Swift Đến + NAPAS Đến'}
        </span>
      </div>

      <LastSyncBanner info={LAST_SYNC_INFO} />

      <KpiBar items={[
        { label: `Tổng GD ${dir}`, val: base.length, color: C.text,    bg: C.neutralBg, border: C.cardBorder, onClick: () => setKpi(null),          isActive: false },
        { label: 'Khớp',           val: totalKhop,   color: '#059669', bg: '#f0fdf4',   border: '#bbf7d0',   onClick: () => toggleKpi('khop'),      isActive: activeKpi === 'khop' },
        { label: 'Khớp lệch ngày', val: totalLech,   color: '#0891b2', bg: '#ecfeff',   border: '#a5f3fc',   onClick: () => toggleKpi('lech'),      isActive: activeKpi === 'lech' },
        { label: 'Cần xử lý',      val: totalNeeds,  color: '#d97706', bg: '#fffbeb',   border: '#fde68a',   onClick: () => toggleKpi('needsAct'),  isActive: activeKpi === 'needsAct' },
        { label: 'Đã xử lý',       val: totalDone,   color: '#7c3aed', bg: '#f5f3ff',   border: '#ddd6fe',   onClick: () => toggleKpi('done'),      isActive: activeKpi === 'done' },
      ]} />

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}`, flexWrap: 'wrap', background: C.neutralBg }}>
          <Input placeholder="Tìm trace, sequence..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <Select value={filterStatus} onChange={e => setFS(e.target.value)} style={{ width: 200 }}>
            <option value="">Tất cả GD</option>
            <option value="NEEDS_ACTION">Cần xử lý</option>
            {Object.entries(RECON_STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </Select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted }}>
            <span>Ngày:</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 130 }} />
            <span>–</span>
            <Input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ width: 130 }} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th colSpan={4} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
                <th colSpan={3} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: '#dbeafe', color: '#1e40af', borderBottom: '1px solid #bfdbfe', borderLeft: '2px solid #93c5fd' }}>SWIFT</th>
                <th colSpan={2} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: '#dcfce7', color: '#166534', borderBottom: '1px solid #bbf7d0', borderLeft: '2px solid #86efac' }}>CORE {dir === 'Đi' ? 'GHI CÓ' : 'GHI NỢ'}</th>
                <th colSpan={4} style={{ padding: '5px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, background: '#fef9c3', color: '#854d0e', borderBottom: '1px solid #fde68a', borderLeft: '2px solid #fcd34d' }}>NAPAS</th>
                <th colSpan={2} style={{ background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }} />
              </tr>
              <tr>
                <th style={th()}>#</th>
                <th style={th()}>Trace</th>
                <th style={th()}>Sequence</th>
                <th style={th()}>Số tiền</th>
                <th style={th({ borderLeft: '2px solid #93c5fd', background: '#eff6ff' })}>Ngày GD (thực tế)</th>
                <th style={th({ background: '#eff6ff' })}>Ngày GN (ghi nhận)</th>
                <th style={th({ background: '#eff6ff' })}>TT Swift</th>
                <th style={th({ borderLeft: '2px solid #86efac', background: '#f0fdf4' })}>Ngày Core</th>
                <th style={th({ background: '#f0fdf4' })}>Ghi</th>
                <th style={th({ borderLeft: '2px solid #fcd34d', background: '#fefce8' })}>Ngày GD</th>
                <th style={th({ background: '#fefce8' })}>Ngày giờ GD</th>
                <th style={th({ background: '#fefce8' })}>Loại</th>
                <th style={th({ background: '#fefce8' })}>TC/KTC</th>
                <th style={th()}>Kết quả</th>
                <th style={th()}>Hướng XL / Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isResolving = resolvingId === r.id
                const res  = RESOLUTION_OF[r.recon_status]
                const t1   = r.swift?.txnDate !== r.swift?.date
                const bg   = i % 2 ? C.neutralBg : '#fff'
                const rowBg = isResolving ? '#fffbeb' : bg
                const sBg  = r.swift ? (bg === '#fff' ? '#f8fbff' : '#f2f8ff') : rowBg
                const cBg  = r.core  ? (bg === '#fff' ? '#f7fdf9' : '#f0fdf4') : rowBg
                const nBg  = r.napas ? (bg === '#fff' ? '#fefdf0' : '#fefce8') : rowBg
                const td   = (ex = {}) => ({ padding: '9px 12px', borderBottom: isResolving ? 'none' : `1px solid ${C.cardBorder}`, background: rowBg, ...ex })

                return (
                  <>
                    <tr key={r.id}>
                      <td style={td({ color: C.textMuted, fontSize: 11 })}>{i + 1}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.primary, fontWeight: 600, fontSize: 12 })}>{r.trace}</td>
                      <td style={td({ fontFamily: 'monospace', color: C.textMuted, fontSize: 11 })}>{r.sequence ?? '—'}</td>
                      <td style={td({ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 })}>{r.amount.toLocaleString('vi-VN')} ₫</td>

                      <td style={td({ borderLeft: '2px solid #93c5fd', background: sBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>{r.swift?.txnDate ?? '—'}</td>
                      <td style={td({ background: sBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>
                        {r.swift?.date ?? '—'}
                        {t1 && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#0891b2', background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 3, padding: '1px 4px' }}>T+1</span>}
                      </td>
                      <td style={td({ background: sBg })}><SwiftStatusCell status={r.swift?.status} /></td>

                      <td style={td({ borderLeft: '2px solid #86efac', background: cBg, fontSize: 12, color: C.textMuted })}>{r.core?.date ?? '—'}</td>
                      <td style={td({ background: cBg })}>
                        {r.core?.entry
                          ? <span style={{ fontSize: 12, fontWeight: 600, color: r.core.entry === 'Ghi có' ? '#059669' : '#2563eb' }}>{r.core.entry}</span>
                          : <Dash />}
                      </td>

                      <td style={td({ borderLeft: '2px solid #fcd34d', background: nBg, fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' })}>{r.napas?.date ?? '—'}</td>
                      <td style={td({ background: nBg, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', fontFamily: 'monospace' })}>
                        {r.napas?.date && r.napas?.time ? `${r.napas.date} ${r.napas.time}` : '—'}
                      </td>
                      <td style={td({ background: nBg })}>{r.napas ? <NapasTypeTag type={r.napas.type} /> : <Dash />}</td>
                      <td style={td({ background: nBg })}>{r.napas ? <NapasStatusCell failed={r.napas.failed} /> : <Dash />}</td>

                      <td style={td()}><StatusBadge status={r.recon_status} /></td>
                      <td style={td({ whiteSpace: 'nowrap' })}>
                        {r.resolved_by
                          ? <span style={{ fontSize: 11, color: C.textMuted }}>{r.resolved_by} · {r.resolved_at}</span>
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
                      <ResolveRow cols={COLS} rowId={r.id} noteInput={noteInput} setNote={setNote}
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
        <div style={{ padding: '10px 16px', fontSize: 12, color: C.textMuted, borderTop: `1px solid ${C.cardBorder}`, display: 'flex', justifyContent: 'space-between' }}>
          <span>Hiển thị <b>{filtered.length}</b> / {base.length} giao dịch {dir}</span>
          <Button size="sm" variant="ghost">Xuất CSV</Button>
        </div>
      </div>
    </>
  )
}

/* ── Date rules data ───────────────────────────────────────────────────────── */
const CLASSIFICATION_OPTIONS = [
  { value: 'KHOP_LECH_NGAY',  label: 'Khớp lệch ngày – chấp nhận tự động' },
  { value: 'TIMEOUT_CO_CORE', label: 'Timeout – Core ghi nhận (cần review)' },
  { value: 'CHI_SWIFT',       label: 'Chỉ Swift – kiểm tra thủ công' },
  { value: 'SWIFT_TIMEOUT',   label: 'Swift timeout – xác nhận hủy' },
  { value: 'SWIFT_THAT_BAI',  label: 'Swift thất bại – xác nhận hủy' },
  { value: 'NAPAS_THAT_BAI',  label: 'NAPAS thất bại – liên hệ đối tác' },
  { value: 'CHI_NAPAS',       label: 'Chỉ NAPAS – kiểm tra thủ công' },
  { value: 'CHI_CORE',        label: 'Chỉ Core – kiểm tra thủ công' },
  { value: 'NGOAI_LE',        label: 'Ngoại lệ – cần điều tra' },
]

const CONDITION_OPTIONS = [
  { value: 'lech_1_ngay',           label: 'Ngày lệch đúng 1 ngày (T±1)' },
  { value: 'lech_2_ngay',           label: 'Ngày lệch đúng 2 ngày (T±2)' },
  { value: 'swift_timeout_core_ok', label: 'Swift TIMEOUT nhưng Core + NAPAS ghi nhận' },
  { value: 'chi_swift_thanh_cong',  label: 'Swift THANH CONG – không có NAPAS / Core' },
  { value: 'swift_timeout_only',    label: 'Swift TIMEOUT – không có NAPAS / Core' },
  { value: 'swift_that_bai',        label: 'Swift THAT BAI – không có NAPAS / Core' },
  { value: 'napas_that_bai',        label: 'NAPAS báo thất bại (file lỗi đi)' },
  { value: 'chi_napas',             label: 'Chỉ có trên NAPAS – không có Swift / Core' },
  { value: 'chi_core',              label: 'Chỉ có trên Core – không có Swift / NAPAS' },
  { value: 'lech_qua_nguong',       label: 'Ngày lệch vượt ngưỡng (> 2 ngày)' },
]

const CONDITION_LABELS = Object.fromEntries(CONDITION_OPTIONS.map(o => [o.value, o.label]))

const INITIAL_DATE_RULES = [
  {
    id: 'dr_001', name: 'Lệch ngày T+1 (Core)',
    description: 'Swift và NAPAS khớp trace/amount cùng ngày T, Core hạch toán vào T+1 do chốt sổ. Tự động chấp nhận.',
    condition: 'lech_1_ngay', classification: 'KHOP_LECH_NGAY', action: 'auto', active: true,
  },
  {
    id: 'dr_002', name: 'Lệch ngày T-1 (NAPAS QT)',
    description: 'NAPAS quyết toán T-1 vào ngày T (cơ chế QT cuối ngày). Swift và Core cùng ngày T, NAPAS ghi T-1. Tự động chấp nhận.',
    condition: 'lech_1_ngay', classification: 'KHOP_LECH_NGAY', action: 'auto', active: true,
  },
  {
    id: 'dr_003', name: 'Lệch 2 ngày (qua cuối tuần / lễ)',
    description: 'Ngày lệch 2 ngày – thường xảy ra qua cuối tuần hoặc ngày nghỉ lễ. Operator cần xác nhận thủ công.',
    condition: 'lech_2_ngay', classification: 'KHOP_LECH_NGAY', action: 'manual', active: true,
  },
  {
    id: 'dr_004', name: 'Swift Timeout – Core + NAPAS ghi nhận',
    description: 'Swift báo timeout nhưng Core và NAPAS đều ghi nhận giao dịch thành công. GD thực sự đã thực hiện – Operator cần review.',
    condition: 'swift_timeout_core_ok', classification: 'TIMEOUT_CO_CORE', action: 'manual', active: true,
  },
  {
    id: 'dr_005', name: 'NAPAS thất bại (file lỗi)',
    description: 'Giao dịch được đánh dấu trong file lỗi NAPAS chiều đi. Cần liên hệ NAPAS để tra cứu.',
    condition: 'napas_that_bai', classification: 'NAPAS_THAT_BAI', action: 'manual', active: true,
  },
  {
    id: 'dr_006', name: 'Lệch ngày quá ngưỡng',
    description: 'Chênh lệch ngày vượt quá 2 ngày – không thể tự động phân loại, đánh dấu ngoại lệ.',
    condition: 'lech_qua_nguong', classification: 'NGOAI_LE', action: 'manual', active: true,
  },
]

/* ── DateRulesTab ──────────────────────────────────────────────────────────── */
function DateRulesTab({ user }) {
  const { showConfirm, toast } = useApp()
  const isAdmin    = user?.role === 'Admin'
  const isOperator = user?.role === 'Operator'

  const [rules, setRules]       = useState(INITIAL_DATE_RULES)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState(null)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit   = (rule) => { setEditing(rule); setFormOpen(true) }

  const toggleActive = (rule) => {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))
    toast(`Quy tắc "${rule.name}" đã ${rule.active ? 'tắt' : 'bật'}.`, 'success')
  }

  const deleteRule = (rule) => showConfirm({
    title: `Xóa quy tắc "${rule.name}"?`,
    message: 'Giao dịch đã phân loại sẽ không bị ảnh hưởng. Giao dịch mới sẽ không áp dụng quy tắc này nữa.',
    variant: 'danger', confirmLabel: 'Xóa',
    onConfirm: () => {
      setRules(prev => prev.filter(r => r.id !== rule.id))
      toast(`Đã xóa quy tắc "${rule.name}".`, 'success')
    },
  })

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 16 }}>
        <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: radius.md, fontSize: 13, color: '#1e40af', flex: 1 }}>
          Quy tắc xác định cách phân loại kết quả sau khi so khớp 3 nguồn: lệch ngày, timeout, chỉ một bên, hay ngoại lệ.
          {isOperator && <span style={{ marginLeft: 8, color: '#3b82f6' }}>Operator chỉ xem – Admin có thể chỉnh sửa.</span>}
        </div>
        {isAdmin && <Button size="sm" onClick={openCreate}>+ Thêm quy tắc</Button>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rules.map((rule) => {
          const sm = RECON_STATUS_META[rule.classification]
          return (
            <div key={rule.id} style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden', opacity: rule.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px' }}>
                {isAdmin && (
                  <button onClick={() => toggleActive(rule)} title={rule.active ? 'Bật – nhấn để tắt' : 'Tắt – nhấn để bật'}
                    style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: rule.active ? C.success : C.cardBorder, position: 'relative', transition: 'background 0.15s' }}>
                    <span style={{ position: 'absolute', top: 3, left: rule.active ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                  </button>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{rule.name}</span>
                    {sm && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>}
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: rule.action === 'auto' ? '#f0fdf4' : C.neutralBg, color: rule.action === 'auto' ? '#059669' : C.textMuted, border: `1px solid ${rule.action === 'auto' ? '#bbf7d0' : C.cardBorder}` }}>
                      {rule.action === 'auto' ? 'Tự động' : 'Thủ công'}
                    </span>
                    {!rule.active && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: C.neutralBg, color: C.textMuted, border: `1px solid ${C.cardBorder}` }}>Đã tắt</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 3 }}>
                    <b>Điều kiện:</b> {CONDITION_LABELS[rule.condition] ?? rule.condition}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{rule.description}</div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rule)}>Sửa</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteRule(rule)} style={{ color: C.error }}>Xóa</Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {rules.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          Chưa có quy tắc nào.{isAdmin && ' Nhấn "+ Thêm quy tắc" để tạo.'}
        </div>
      )}

      {isAdmin && (
        <DateRuleFormModal
          open={formOpen} editing={editing}
          onClose={() => setFormOpen(false)}
          onSave={(data) => {
            if (editing) {
              setRules(prev => prev.map(r => r.id === editing.id ? { ...r, ...data } : r))
              toast('Đã lưu quy tắc.', 'success')
            } else {
              setRules(prev => [...prev, { ...data, id: 'dr_' + Date.now() }])
              toast('Đã thêm quy tắc mới.', 'success')
            }
            setFormOpen(false)
          }}
        />
      )}
    </>
  )
}

function DateRuleFormModal({ open, editing, onClose, onSave }) {
  const blank = { name: '', description: '', condition: 'lech_1_ngay', classification: 'KHOP_LECH_NGAY', action: 'auto', active: true }
  const [form, setForm] = useState(() => editing ?? blank)
  useState(() => { if (open) setForm(editing ?? blank) })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open={open} title={editing ? 'Sửa quy tắc' : 'Thêm quy tắc phân loại'} onClose={onClose} onConfirm={() => onSave(form)} width={580}>
      <FormRow label="Tên quy tắc">
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="VD: Lệch ngày T+1 (Core)" />
      </FormRow>
      <FormRow label="Mô tả">
        <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Mô tả điều kiện và cách xử lý..." />
      </FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormRow label="Điều kiện">
          <Select value={form.condition} onChange={e => set('condition', e.target.value)}>
            {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FormRow>
        <FormRow label="Phân loại kết quả">
          <Select value={form.classification} onChange={e => set('classification', e.target.value)}>
            {CLASSIFICATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FormRow>
        <FormRow label="Cách xử lý">
          <Select value={form.action} onChange={e => set('action', e.target.value)}>
            <option value="auto">Tự động – không cần xác nhận</option>
            <option value="manual">Thủ công – Operator xác nhận</option>
          </Select>
        </FormRow>
        <FormRow label="Trạng thái">
          <Select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')}>
            <option value="true">Đang bật</option>
            <option value="false">Đã tắt</option>
          </Select>
        </FormRow>
      </div>
    </Modal>
  )
}
