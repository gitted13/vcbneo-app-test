import { useApp } from '../context/AppContext'
import { C, radius, shadow } from '../theme'
import Button from './Button'

export default function ConfirmDialog() {
  const { confirm, closeConfirm } = useApp()
  if (!confirm) return null

  const handleConfirm = () => {
    confirm.onConfirm?.()
    closeConfirm()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={closeConfirm}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: radius.xl,
          boxShadow: shadow.xl, padding: '28px 32px',
          width: 420, maxWidth: '90vw',
        }}
      >
        {confirm.icon && (
          <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 14 }}>{confirm.icon}</div>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          {confirm.title}
        </div>
        {confirm.message && (
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
            {confirm.message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={closeConfirm}>Hủy</Button>
          <Button
            variant={confirm.variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
          >
            {confirm.confirmLabel ?? 'Xác nhận'}
          </Button>
        </div>
      </div>
    </div>
  )
}
