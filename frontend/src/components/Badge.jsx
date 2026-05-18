import { C } from '../theme'

const VARIANTS = {
  success: { bg: C.successBg, color: C.success, border: C.successBorder },
  warning: { bg: C.warningBg, color: C.warning, border: C.warningBorder },
  error:   { bg: C.errorBg,   color: C.error,   border: C.errorBorder   },
  primary: { bg: C.primaryLight, color: C.primary, border: C.primaryBorder },
  neutral: { bg: C.neutralBg,    color: C.textMuted, border: C.neutralBorder },
}

export default function Badge({ variant = 'neutral', children, dot }) {
  const v = VARIANTS[variant] ?? VARIANTS.neutral
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: v.bg, color: v.color,
      border: `1px solid ${v.border}`,
      whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: v.color, flexShrink: 0 }} />}
      {children}
    </span>
  )
}
