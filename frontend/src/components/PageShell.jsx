import { C, font, shadow } from '../theme'

export default function PageShell({ title, subtitle, actions, children }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: font['2xl'], fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.2 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: font.base, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0, marginTop: 2 }}>{actions}</div>}
      </div>
      {children}
    </div>
  )
}
