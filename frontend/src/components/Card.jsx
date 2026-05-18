import { C, shadow, radius } from '../theme'

export default function Card({ title, subtitle, actions, children, style, noPad }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: radius.lg,
      boxShadow: shadow.sm,
      ...style,
    }}>
      {(title || actions) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${C.cardBorder}`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      <div style={noPad ? {} : { padding: '16px 20px' }}>
        {children}
      </div>
    </div>
  )
}
