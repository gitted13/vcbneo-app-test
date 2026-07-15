import { useState, useEffect } from 'react'
import { C } from '../theme'

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 75, 100]

export function usePagination(totalItems, pageSize, page, setPage) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage   = Math.min(page, totalPages)
  return { totalPages, safePage }
}

export default function Pagination({ total, page, pageSize, onPage, onPageSize, itemLabel = 'giao dịch' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  const pages = buildPageList(page, totalPages)

  const [jumpVal, setJumpVal] = useState(String(page))
  useEffect(() => { setJumpVal(String(page)) }, [page])

  const commitJump = () => {
    const n = Math.round(Number(jumpVal))
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) onPage(n)
    else setJumpVal(String(page))
  }

  const btn = (active, disabled, onClick, label) => (
    <button
      key={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        minWidth: 32, height: 30, padding: '0 8px',
        border: `1px solid ${active ? C.primary : C.cardBorder}`,
        borderRadius: 6,
        background: active ? C.primary : disabled ? C.neutralBg : '#fff',
        color: active ? '#fff' : disabled ? C.textLight : C.text,
        fontSize: 12, fontWeight: active ? 700 : 400,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: `1px solid ${C.cardBorder}`, background: C.neutralBg, flexWrap: 'wrap', gap: 8 }}>
      {/* Left: info + page size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {total === 0 ? 'Không có dữ liệu' : `${from}–${to} / ${total} ${itemLabel}`}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted }}>
          Hiển thị
          <select
            value={pageSize}
            onChange={e => { onPageSize(Number(e.target.value)); onPage(1) }}
            style={{ height: 28, padding: '0 4px', border: `1px solid ${C.cardBorder}`, borderRadius: 6, fontSize: 12, background: '#fff', color: C.text, cursor: 'pointer' }}
          >
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          dòng
        </label>
      </div>

      {/* Right: page buttons + typeable page jump */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {btn(false, page <= 1,          () => onPage(1),          '«')}
          {btn(false, page <= 1,          () => onPage(page - 1),   '‹')}
          {pages.map((p, i) =>
            p === '...'
              ? <span key={`e${i}`} style={{ fontSize: 12, color: C.textMuted, padding: '0 4px' }}>…</span>
              : btn(p === page, false, () => onPage(p), p)
          )}
          {btn(false, page >= totalPages, () => onPage(page + 1),   '›')}
          {btn(false, page >= totalPages, () => onPage(totalPages),  '»')}

          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted, marginLeft: 8 }}>
            Đến trang
            <input
              type="number" min={1} max={totalPages} value={jumpVal}
              onChange={e => setJumpVal(e.target.value)}
              onBlur={commitJump}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitJump() } }}
              style={{ width: 52, height: 28, padding: '0 6px', border: `1px solid ${C.cardBorder}`, borderRadius: 6, fontSize: 12, textAlign: 'center', fontFamily: 'inherit' }}
            />
            / {totalPages}
          </span>
        </div>
      )}
    </div>
  )
}

function buildPageList(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  pages.push(1)
  if (page > 3) pages.push('...')
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) pages.push(p)
  if (page < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
