import { useState } from 'react'
import { C } from '../theme'

export default function DataTable({ columns, rows, pageSize = 50, emptyText = 'Không có dữ liệu' }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey]
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
    : rows

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const paged      = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
  const showPager  = sorted.length > pageSize

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
  const pgBtn = (disabled) => ({
    padding: '4px 10px', fontSize: 12, fontWeight: 600,
    border: `1px solid ${C.cardBorder}`, borderRadius: 5,
    background: disabled ? C.neutralBg : '#fff',
    color: disabled ? C.textLight : C.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  })

  return (
    <div>
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
            ) : paged.map((row, i) => (
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

      {showPager && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${C.cardBorder}`, fontSize: 12, color: C.textMuted }}>
          <span>
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)}
            <span style={{ color: C.textLight }}> / {sorted.length} bản ghi</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button style={pgBtn(safePage === 1)} disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>‹ Trước</button>
            <span style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, color: C.text }}>{safePage} / {totalPages}</span>
            <button style={pgBtn(safePage === totalPages)} disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>Sau ›</button>
          </div>
        </div>
      )}
    </div>
  )
}
