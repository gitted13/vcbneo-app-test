import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { C, radius, shadow } from '../../theme'

const FILE_TYPE_COLORS = {
  'Swift Report Đi':        '#2563eb',
  'Swift Report Đến':       '#7c3aed',
  'Core (Ghi có / Ghi nợ)': '#059669',
  'Napas Đi':               '#d97706',
  'Napas Đến':              '#dc2626',
  'Napas Đi Thất bại':      '#64748b',
}

const ROWS = [
  { id: 1,  time: '2026-02-05 08:14', type: 'Swift Report Đi',        file: 'Swift report đi_20260205.xlsx',  source: 'Thủ công', user: 'admin',  valid: true,  size: '1.2 MB', sheets: 3 },
  { id: 2,  time: '2026-02-05 08:14', type: 'Swift Report Đến',       file: 'Swift report đến_20260205.xlsx', source: 'Thủ công', user: 'admin',  valid: true,  size: '0.8 MB', sheets: 3 },
  { id: 3,  time: '2026-02-05 06:00', type: 'Napas Đi',               file: 'Napas_di_20260205.xlsx',         source: 'RPA-0044', user: 'system', valid: true,  size: '2.1 MB', sheets: 3 },
  { id: 4,  time: '2026-02-05 06:00', type: 'Napas Đến',              file: 'Napas_den_20260205.xlsx',        source: 'RPA-0044', user: 'system', valid: true,  size: '1.4 MB', sheets: 3 },
  { id: 5,  time: '2026-02-05 06:00', type: 'Core (Ghi có / Ghi nợ)',file: 'Core_20260205.xlsx',             source: 'RPA-0044', user: 'system', valid: true,  size: '3.6 MB', sheets: 2 },
  { id: 6,  time: '2026-02-04 06:01', type: 'Napas Đi Thất bại',     file: 'Napas_KTC_20260204.xlsx',        source: 'RPA-0043', user: 'system', valid: false, size: '0.2 MB', sheets: 1, error: 'Thiếu cột bắt buộc: Số tiền' },
  { id: 7,  time: '2026-02-04 08:30', type: 'Swift Report Đi',        file: 'Swift report đi_20260204.xlsx',  source: 'Thủ công', user: 'user1',  valid: true,  size: '1.1 MB', sheets: 3 },
  { id: 8,  time: '2026-02-03 06:00', type: 'Napas Đi',               file: 'Napas_di_20260203.xlsx',         source: 'RPA-0042', user: 'system', valid: true,  size: '1.9 MB', sheets: 3 },
]

export default function History() {
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterValid, setFilterValid] = useState('')

  const types = [...new Set(ROWS.map(r => r.type))]

  const filtered = ROWS.filter(r => {
    if (search && !r.file.toLowerCase().includes(search.toLowerCase()) && !r.type.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && r.type !== filterType) return false
    if (filterSource === 'manual' && r.source !== 'Thủ công') return false
    if (filterSource === 'rpa' && !r.source.startsWith('RPA')) return false
    if (filterValid === 'valid' && !r.valid) return false
    if (filterValid === 'invalid' && r.valid) return false
    return true
  })

  const stats = [
    { label: 'Tổng file',  val: ROWS.length,                                  color: C.primary,  bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '#bfdbfe' },
    { label: 'Hợp lệ',    val: ROWS.filter(r => r.valid).length,              color: C.success,  bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#bbf7d0' },
    { label: 'Lỗi',       val: ROWS.filter(r => !r.valid).length,             color: C.error,    bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fecaca' },
    { label: 'Từ RPA',    val: ROWS.filter(r => r.source.startsWith('RPA')).length, color: '#d97706', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fde68a' },
    { label: 'Thủ công',  val: ROWS.filter(r => r.source === 'Thủ công').length,    color: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '#c4b5fd' },
  ]

  return (
    <PageShell title="Lịch sử nhập liệu" subtitle="Toàn bộ lịch sử file đã tải vào hệ thống, bao gồm từ tải thủ công và RPA.">
      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.border}`, borderRadius: radius.md, padding: '14px 16px', textAlign: 'center', boxShadow: shadow.sm }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Card noPad>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${C.cardBorder}`, flexWrap: 'wrap' }}>
          <Input placeholder="Tìm theo tên file, loại..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 190 }}>
            <option value="">Tất cả loại file</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ width: 140 }}>
            <option value="">Tất cả nguồn</option>
            <option value="manual">Thủ công</option>
            <option value="rpa">RPA</option>
          </Select>
          <Select value={filterValid} onChange={e => setFilterValid(e.target.value)} style={{ width: 140 }}>
            <option value="">Tất cả trạng thái</option>
            <option value="valid">Hợp lệ</option>
            <option value="invalid">Lỗi</option>
          </Select>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Thời gian', 'Loại file', 'Tên file', 'Nguồn', 'Người dùng', 'Dung lượng', 'Sheets', 'Trạng thái', ''].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const typeColor = FILE_TYPE_COLORS[r.type] ?? C.primary
              return (
                <>
                  <tr key={r.id} style={{ borderBottom: r.error ? 'none' : `1px solid ${C.cardBorder}`, background: r.error ? '#fff8f8' : (i % 2 ? C.neutralBg : '#fff') }}>
                    <td style={{ padding: '10px 14px', color: C.textMuted, whiteSpace: 'nowrap', fontSize: 12 }}>{r.time}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: typeColor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: C.text }}>{r.type}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: typeColor }}>{r.file}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.source === 'Thủ công'
                        ? <Badge variant="primary">{r.source}</Badge>
                        : <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{r.source}</span>
                      }
                    </td>
                    <td style={{ padding: '10px 14px', color: C.textMuted, fontSize: 12 }}>{r.user}</td>
                    <td style={{ padding: '10px 14px', color: C.textMuted, fontSize: 12 }}>{r.size}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: C.textMuted }}>{r.sheets}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <Badge variant={r.valid ? 'success' : 'error'} dot>{r.valid ? 'Hợp lệ' : 'Lỗi'}</Badge>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Button size="sm" variant="ghost">Xem</Button>
                    </td>
                  </tr>
                  {r.error && (
                    <tr key={r.id + '_err'} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                      <td colSpan={9} style={{ padding: '6px 14px 10px 44px', fontSize: 12, color: C.error, background: '#fef2f2', borderLeft: `3px solid ${C.error}` }}>
                        Lỗi validation: <b>{r.error}</b>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', color: C.textMuted, fontSize: 12, borderTop: `1px solid ${C.cardBorder}` }}>
          Hiển thị <b>{filtered.length}</b> / {ROWS.length} bản ghi
        </div>
      </Card>
    </PageShell>
  )
}
