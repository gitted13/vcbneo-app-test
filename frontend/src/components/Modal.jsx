import { C, shadow, radius } from '../theme'
import Button from './Button'

export default function Modal({ open, title, onClose, onConfirm, confirmLabel = 'Lưu', confirmVariant = 'primary', width = 560, children }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.card, borderRadius: radius.xl, boxShadow: shadow.xl,
          width, maxWidth: '95vw', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: `1px solid ${C.cardBorder}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.textLight, lineHeight: 1, padding: 2 }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${C.cardBorder}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          background: C.neutralBg,
        }}>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          {onConfirm && <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>}
        </div>
      </div>
    </div>
  )
}
