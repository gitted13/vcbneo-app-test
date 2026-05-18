import { C, radius } from '../theme'

const VARIANTS = {
  primary: { bg: C.primary, hover: C.primaryHover, color: '#fff', border: C.primary },
  danger:  { bg: C.error,   hover: '#b91c1c',       color: '#fff', border: C.error },
  ghost:   { bg: 'transparent', hover: C.bgHover, color: C.text, border: C.cardBorder },
  subtle:  { bg: C.neutralBg, hover: C.bgHover, color: C.text, border: C.neutralBorder },
}

export default function Button({ variant = 'primary', size = 'md', children, onClick, disabled, type = 'button', icon, style }) {
  const v = VARIANTS[variant] ?? VARIANTS.primary
  const pad = size === 'sm' ? '5px 12px' : size === 'lg' ? '10px 24px' : '7px 16px'
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 14 : 13

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: pad, borderRadius: radius.md,
        border: `1px solid ${v.border}`,
        background: disabled ? C.neutralBg : v.bg,
        color: disabled ? C.textLight : v.color,
        fontSize: fs, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.12s',
        ...style,
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  )
}
