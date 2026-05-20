import { C, radius, shadow } from '../theme'
import { Input } from './Input'
import Button from './Button'
import { RECON_STATUS_META, LAST_SYNC_INFO } from '../data/reconcile'

export function DirectionToggle({ value, onChange }) {
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

export function KpiBar({ items }) {
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

export function ResolveRow({ cols, noteInput, setNote, onConfirm, onCancel }) {
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

export function SwiftStatusCell({ status }) {
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

export function NapasStatusCell({ failed }) {
  if (failed == null) return <Dash />
  return failed
    ? <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>✕ KTC</span>
    : <span style={{ fontSize: 11, color: '#059669' }}>✓ TC</span>
}

export function NapasTypeTag({ type }) {
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

export function StatusBadge({ status }) {
  const m = RECON_STATUS_META[status]
  if (!m) return <span style={{ color: C.textMuted }}>{status}</span>
  return (
    <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: m.bg, color: m.color, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  )
}

export function Dash() { return <span style={{ color: C.textLight }}>—</span> }

/* ── LastSyncBanner ──────────────────────────────────────────────────────────
   Hiển thị thời gian đồng bộ/đối soát lần cuối. Giúp người dùng biết dữ liệu
   có thể chưa đầy đủ nếu RPA chưa chạy hôm nay. info mặc định = LAST_SYNC_INFO.
   ─────────────────────────────────────────────────────────────────────────── */
export function LastSyncBanner({ info = LAST_SYNC_INFO }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      padding: '8px 16px', marginBottom: 16,
      background: '#f8fafc', border: `1px solid ${C.cardBorder}`,
      borderRadius: radius.md, fontSize: 12, color: C.textMuted,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
        <span>Dữ liệu đến: <b style={{ color: C.text }}>{info.dataUpTo}</b></span>
      </span>
      <span style={{ color: C.cardBorder }}>|</span>
      <span>Đồng bộ lần cuối: <b style={{ color: C.text }}>{info.syncedAt}</b></span>
      <span style={{ color: C.cardBorder }}>|</span>
      <span>Đối soát lần cuối: <b style={{ color: C.text }}>{info.reconAt}</b></span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>
        Dữ liệu sau {info.dataUpTo} có thể chưa đủ nếu đồng bộ chưa hoàn thành.
      </span>
    </div>
  )
}
