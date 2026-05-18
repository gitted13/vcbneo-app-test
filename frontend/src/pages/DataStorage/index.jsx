import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { C, radius, shadow } from '../../theme'

/* ── Table definitions – 3 consolidated tables ──────────────────────────────── */
const TABLES = [
  {
    id: 'swift', name: 'Swift', color: '#2563eb',
    bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    border: '#bfdbfe',
    description: 'Giao dịch Swift Đi & Đến',
    subtabs: [
      { id: 'swift_di',  label: 'Swift Đi',  rows: 8381,  lastUpdate: '05/02/2026 08:14', cols: ['seq','trace','hostdate','amount','status'] },
      { id: 'swift_den', label: 'Swift Đến', rows: 6104,  lastUpdate: '05/02/2026 08:14', cols: ['seq','trace','hostdate','amount','status'] },
    ],
  },
  {
    id: 'core', name: 'Core', color: '#059669',
    bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    border: '#bbf7d0',
    description: 'Core Banking – Ghi có & Ghi nợ',
    subtabs: [
      { id: 'core_ghico',  label: 'Ghi có',  rows: 6842,  lastUpdate: '05/02/2026 06:00', cols: ['trace','hostdate','amount','dien_giai','ngay_hach_toan'] },
      { id: 'core_ghino',  label: 'Ghi nợ',  rows: 5389,  lastUpdate: '05/02/2026 06:00', cols: ['trace','hostdate','amount','dien_giai','ngay_hach_toan'] },
    ],
  },
  {
    id: 'napas', name: 'NAPAS', color: '#d97706',
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '#fde68a',
    description: 'NAPAS Đi, Đến & Thất bại',
    subtabs: [
      { id: 'napas_di',      label: 'Napas Đi',        rows: 9381,  lastUpdate: '05/02/2026 06:00', cols: ['trace','ngay_gd','amount','ma_ngan_hang','trang_thai'] },
      { id: 'napas_den',     label: 'Napas Đến',       rows: 5086,  lastUpdate: '05/02/2026 06:00', cols: ['trace','ngay_gd','amount','ma_ngan_hang','trang_thai'] },
      { id: 'napas_di_fail', label: 'Napas Thất bại',  rows: 21,    lastUpdate: '05/02/2026 06:00', cols: ['trace','ngay_gd','amount','ly_do'] },
    ],
  },
]

/* ── Mock data ──────────────────────────────────────────────────────────────── */
const MOCK_ROWS = {
  swift_di: [
    { seq: 1001, trace: '700112345', hostdate: '20260201', amount: 5000000,  status: 'THANH CONG' },
    { seq: 1002, trace: '700112346', hostdate: '20260201', amount: 12000000, status: 'THANH CONG' },
    { seq: 1003, trace: '700112347', hostdate: '20260202', amount: 3500000,  status: 'TIMEOUT'    },
    { seq: 1004, trace: '700112348', hostdate: '20260201', amount: 8000000,  status: 'THAT BAI'   },
    { seq: 1005, trace: '700112349', hostdate: '20260202', amount: 2100000,  status: 'THANH CONG' },
  ],
  swift_den: [
    { seq: 2001, trace: '700212345', hostdate: '20260201', amount: 3200000,  status: 'THANH CONG' },
    { seq: 2002, trace: '700212346', hostdate: '20260201', amount: 9100000,  status: 'THANH CONG' },
    { seq: 2003, trace: '700212347', hostdate: '20260202', amount: 7700000,  status: 'TIMEOUT'    },
  ],
  core_ghico: [
    { trace: '700112345', hostdate: '20260201', amount: 5000000,  dien_giai: 'CK DEN/700112345', ngay_hach_toan: '20260201' },
    { trace: '700112346', hostdate: '20260201', amount: 12000000, dien_giai: 'CK DEN/700112346', ngay_hach_toan: '20260201' },
    { trace: '700112349', hostdate: '20260202', amount: 2100000,  dien_giai: 'CK DEN/700112349', ngay_hach_toan: '20260202' },
  ],
  core_ghino: [
    { trace: '700212345', hostdate: '20260201', amount: 3200000,  dien_giai: 'CK DI/700212345',  ngay_hach_toan: '20260201' },
    { trace: '700212346', hostdate: '20260201', amount: 9100000,  dien_giai: 'CK DI/700212346',  ngay_hach_toan: '20260201' },
  ],
  napas_di: [
    { trace: '700112345', ngay_gd: '20260131', amount: 5000000,  ma_ngan_hang: '970423', trang_thai: 'THANH CONG' },
    { trace: '700112346', ngay_gd: '20260131', amount: 12000000, ma_ngan_hang: '970415', trang_thai: 'THANH CONG' },
    { trace: '700112347', ngay_gd: '20260201', amount: 3500000,  ma_ngan_hang: '970436', trang_thai: 'TIMEOUT'    },
  ],
  napas_den: [
    { trace: '700212345', ngay_gd: '20260131', amount: 3200000, ma_ngan_hang: '970423', trang_thai: 'THANH CONG' },
    { trace: '700212346', ngay_gd: '20260131', amount: 9100000, ma_ngan_hang: '970415', trang_thai: 'THANH CONG' },
  ],
  napas_di_fail: [
    { trace: '700112003', ngay_gd: '20260131', amount: 1500000, ly_do: 'Lỗi kết nối ngân hàng nhận' },
    { trace: '700112004', ngay_gd: '20260131', amount: 800000,  ly_do: 'Số tài khoản không hợp lệ' },
  ],
}

/* ── helpers ────────────────────────────────────────────────────────────────── */
const AMOUNT_COLS = ['amount']
const STATUS_COLS = ['status', 'trang_thai']

function statusBadge(val) {
  if (val === 'THANH CONG') return <Badge variant="success" dot>Thành công</Badge>
  if (val === 'TIMEOUT')    return <Badge variant="warning" dot>Timeout</Badge>
  if (val === 'THAT BAI')   return <Badge variant="error"   dot>Thất bại</Badge>
  return <span style={{ fontSize: 12, color: C.textMuted }}>{val}</span>
}

/* ── Main page ──────────────────────────────────────────────────────────────── */
export default function DataStorage() {
  const [activeTableId, setActiveTableId] = useState('swift')
  const [activeSubtabs, setActiveSubtabs] = useState({ swift: 'swift_di', core: 'core_ghico', napas: 'napas_di' })
  const [search, setSearch]               = useState('')
  const [filterStatus, setFilterStatus]   = useState('')

  const table   = TABLES.find(t => t.id === activeTableId)
  const subtabId = activeSubtabs[activeTableId]
  const subtab  = table.subtabs.find(s => s.id === subtabId)
  const rows    = MOCK_ROWS[subtabId] ?? []
  const cols    = subtab?.cols ?? []

  const setSubtab = (tableId, subId) => setActiveSubtabs(p => ({ ...p, [tableId]: subId }))

  const filtered = rows.filter(row => {
    if (search && !Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))) return false
    if (filterStatus) {
      const statusVal = row.status ?? row.trang_thai ?? ''
      if (statusVal !== filterStatus) return false
    }
    return true
  })

  const totalRows = table.subtabs.reduce((s, t) => s + t.rows, 0)
  const hasStatus = cols.some(c => STATUS_COLS.includes(c))

  return (
    <PageShell title="Kho dữ liệu" subtitle="Dữ liệu đã trích xuất, lưu trữ theo 3 bảng: Swift · Core · NAPAS">
      {/* Table selector cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {TABLES.map(t => {
          const total = t.subtabs.reduce((s, x) => s + x.rows, 0)
          const active = activeTableId === t.id
          return (
            <div
              key={t.id}
              onClick={() => setActiveTableId(t.id)}
              style={{
                padding: '16px 20px',
                background: active ? t.bg : '#fff',
                border: `2px solid ${active ? t.color : C.cardBorder}`,
                borderRadius: radius.lg,
                cursor: 'pointer',
                boxShadow: active ? shadow.md : shadow.sm,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: active ? t.color : C.text }}>{t.name}</span>
                {active && <Badge variant="primary">Đang xem</Badge>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: active ? t.color : C.text, marginBottom: 2 }}>
                {total.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{t.description}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {t.subtabs.map(s => (
                  <span key={s.id} style={{ fontSize: 10, padding: '2px 7px', background: active ? 'rgba(255,255,255,0.7)' : C.neutralBg, border: `1px solid ${active ? t.border : C.cardBorder}`, borderRadius: 4, color: C.textMuted }}>
                    {s.label}: {s.rows.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Data browser */}
      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.neutralBg }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: table.color }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{table.name}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              {totalRows.toLocaleString()} bản ghi tổng · cập nhật {subtab?.lastUpdate}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="ghost">Xuất CSV</Button>
            <Button size="sm" variant="subtle">Làm mới</Button>
          </div>
        </div>

        {/* Subtab pills */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: `1px solid ${C.cardBorder}`, background: '#fff' }}>
          {table.subtabs.map(s => {
            const active = s.id === subtabId
            return (
              <button
                key={s.id}
                onClick={() => setSubtab(activeTableId, s.id)}
                style={{
                  padding: '5px 14px', borderRadius: 20,
                  fontSize: 12, fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  background: active ? table.color : 'transparent',
                  color: active ? '#fff' : C.textMuted,
                  border: active ? 'none' : `1px solid ${C.cardBorder}`,
                  transition: 'all 0.12s',
                }}
              >
                {s.label}
                <span style={{ marginLeft: 6, opacity: 0.75, fontSize: 11 }}>({s.rows.toLocaleString()})</span>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.cardBorder}` }}>
          <Input placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          {hasStatus && (
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 170 }}>
              <option value="">Tất cả trạng thái</option>
              <option value="THANH CONG">Thành công</option>
              <option value="TIMEOUT">Timeout</option>
              <option value="THAT BAI">Thất bại</option>
            </Select>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                    {c.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 ? C.neutralBg : '#fff' }}>
                  {cols.map(c => (
                    <td key={c} style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                      {STATUS_COLS.includes(c)
                        ? statusBadge(row[c])
                        : AMOUNT_COLS.includes(c)
                          ? <span style={{ fontFamily: 'monospace', fontWeight: 600, color: C.text }}>{Number(row[c]).toLocaleString('vi-VN')} ₫</span>
                          : <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{row[c]}</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={cols.length} style={{ padding: '32px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                    Không tìm thấy bản ghi phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '10px 16px', fontSize: 12, color: C.textMuted, borderTop: `1px solid ${C.cardBorder}` }}>
          Hiển thị <b>{filtered.length}</b> / {(subtab?.rows ?? 0).toLocaleString()} bản ghi
        </div>
      </div>
    </PageShell>
  )
}
