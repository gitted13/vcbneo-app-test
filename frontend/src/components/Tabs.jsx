import { useState } from 'react'
import { C } from '../theme'

export default function Tabs({ tabs, children, style }) {
  const [active, setActive] = useState(0)
  return (
    <div style={style}>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: `1px solid ${C.cardBorder}`,
        marginBottom: 20,
      }}>
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              padding: '9px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active === i ? 600 : 400,
              color: active === i ? C.primary : C.textMuted,
              borderBottom: active === i ? `2px solid ${C.primary}` : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.12s',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {Array.isArray(children) ? children[active] : children}
    </div>
  )
}
