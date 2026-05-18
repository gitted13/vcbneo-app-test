import { C, radius } from '../theme'

const base = {
  width: '100%',
  padding: '7px 10px',
  border: `1px solid ${C.cardBorder}`,
  borderRadius: radius.md,
  fontSize: 13,
  color: C.text,
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

export function Input({ style, ...props }) {
  return <input style={{ ...base, ...style }} {...props} />
}

export function Select({ children, style, ...props }) {
  return <select style={{ ...base, ...style }} {...props}>{children}</select>
}

export function FormRow({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 5 }}>{label}</div>}
      {children}
      {hint && <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}
