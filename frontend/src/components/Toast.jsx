import { useApp } from '../context/AppContext'
import { C, radius, shadow } from '../theme'

const VARIANTS = {
  success: { bg: C.successBg, border: C.successBorder, color: C.success,  icon: '✓' },
  error:   { bg: C.errorBg,   border: C.errorBorder,   color: C.error,    icon: '✕' },
  warning: { bg: C.warningBg, border: C.warningBorder, color: C.warning,  icon: '!' },
  info:    { bg: C.primaryLight, border: C.primaryBorder, color: C.primary, icon: 'i' },
}

export default function ToastContainer() {
  const { toasts, setToasts } = useApp()
  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  if (!toasts.length) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const v = VARIANTS[t.variant] ?? VARIANTS.success
        return (
          <div
            key={t.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', minWidth: 280, maxWidth: 420,
              background: v.bg, border: `1px solid ${v.border}`,
              borderRadius: radius.lg, boxShadow: shadow.lg,
              fontSize: 13, color: C.text,
              pointerEvents: 'auto',
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: v.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>
              {v.icon}
            </div>
            <span style={{ flex: 1, lineHeight: 1.5 }}>{t.msg}</span>
            <button
              onClick={() => dismiss(t.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
