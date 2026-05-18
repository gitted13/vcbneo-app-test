import { useState } from 'react'
import { C } from '../theme'

export default function DataTable({ columns, rows, emptyText = 'Không có dữ liệu' }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey]
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
    : rows

  const th = {
    padding: '9px 14px', fontSize: 11, fontWeight: 700, color: C.textMuted,
    textAlign: 'left', background: C.neutralBg,
    borderBottom: `1px solid ${C.cardBorder}`,
    whiteSpace: 'nowrap', userSelect: 'none',
    textTransform: 'uppercase', letterSpacing: 0.5,
  }
  const td = {
    padding: '10px 14px', fontSize: 13, color: C.text,
    borderBottom: `1px solid ${C.cardBorder}`,
    verticalAlign: 'middle',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ ...th, cursor: col.sortable ? 'pointer' : 'default', width: col.width }}
                onClick={() => col.sortable && toggleSort(col.key)}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ ...td, textAlign: 'center', color: C.textMuted, padding: 32 }}>{emptyText}</td></tr>
          ) : sorted.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : C.neutralBg }}>
              {columns.map(col => (
                <td key={col.key} style={{ ...td, textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
