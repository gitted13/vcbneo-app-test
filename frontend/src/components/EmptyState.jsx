import { C, radius } from '../theme'
import Button from './Button'

export default function EmptyState({ icon, title, description, action, onAction }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '52px 32px', textAlign: 'center',
      border: `1px dashed ${C.neutralBorder}`,
      borderRadius: radius.lg,
      background: C.neutralBg,
    }}>
      {icon && <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.5 }}>{icon}</div>}
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 380, lineHeight: 1.6 }}>{description}</div>}
      {action && (
        <div style={{ marginTop: 20 }}>
          <Button onClick={onAction}>{action}</Button>
        </div>
      )}
    </div>
  )
}
