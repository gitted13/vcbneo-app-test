import { useState, useEffect } from 'react'
import PageShell from '../../components/PageShell'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'

function formatDate(val) {
  const s = String(val ?? '')
  if (s.length !== 8) return s
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`
}

const DATE_COLS   = ['hostdate', 'ngay_gd', 'ngay_hach_toan', 'ngay']
const AMOUNT_COLS = ['amount']
const STATUS_COLS = ['status', 'trang_thai']

const COL_LABELS = {
  seq:            'STT',
  trace:          'Số trace',
  hostdate:       'Ngày GD',
  amount:         'Số tiền',
  status:         'Trạng thái',
  trang_thai:     'Trạng thái',
  ngay_gd:        'Ngày GD',
  ngay:           'Ngày',
  ngay_hach_toan: 'Ngày hạch toán',
  dien_giai:      'Diễn giải',
  teller:         'Teller',
  kind:           'Loại GD',
  ma_ngan_hang:   'Mã ngân hàng',
  ly_do:          'Lý do',
}

function statusText(val) {
  if (val === 'THANH CONG') return <span style={{ color: '#059669', fontWeight: 600, fontSize: 12 }}>Thành công</span>
  if (val === 'TIMEOUT')    return <span style={{ color: '#d97706', fontWeight: 600, fontSize: 12 }}>Timeout</span>
  if (val === 'THAT BAI')   return <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 12 }}>Thất bại</span>
  return <span style={{ fontSize: 12, color: C.textMuted }}>{val}</span>
}

const RAW_TABLES = [
  {
    id: 'swift', name: 'Swift', color: '#2563eb',
    bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '#bfdbfe',
    description: 'Swift Đi & Đến',
    subtabs: [
      { id: 'swift_di',  label: 'Swift Đi',  rows: 8381,  lastUpdate: '05/02/2026 08:14', cols: ['seq','trace','hostdate','amount','status'] },
      { id: 'swift_den', label: 'Swift Đến', rows: 6104,  lastUpdate: '05/02/2026 08:14', cols: ['seq','trace','hostdate','amount','status'] },
    ],
  },
  {
    id: 'core', name: 'Core', color: '#059669',
    bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '#bbf7d0',
    description: 'Core Banking – Ghi có & Ghi nợ',
    subtabs: [
      { id: 'core_ghico', label: 'Ghi có', rows: 6842, lastUpdate: '05/02/2026 06:00', cols: ['trace','hostdate','amount','dien_giai','ngay_hach_toan'] },
      { id: 'core_ghino', label: 'Ghi nợ', rows: 5389, lastUpdate: '05/02/2026 06:00', cols: ['trace','hostdate','amount','dien_giai','ngay_hach_toan'] },
    ],
  },
  {
    id: 'napas', name: 'NAPAS', color: '#d97706',
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '#fde68a',
    description: 'NAPAS Đi, Đến & Thất bại',
    subtabs: [
      { id: 'napas_di',      label: 'Napas Đi',       rows: 9381, lastUpdate: '05/02/2026 06:00', cols: ['trace','ngay_gd','amount','ma_ngan_hang','trang_thai'] },
      { id: 'napas_den',     label: 'Napas Đến',      rows: 5086, lastUpdate: '05/02/2026 06:00', cols: ['trace','ngay_gd','amount','ma_ngan_hang','trang_thai'] },
      { id: 'napas_di_fail', label: 'Napas Thất bại', rows: 21,   lastUpdate: '05/02/2026 06:00', cols: ['trace','ngay_gd','amount','ly_do'] },
    ],
  },
]

// Dữ liệu mẫu khớp với 19 giao dịch trong trang Đối soát (01–03/02/2026).
const RAW_MOCK = {
  // 12 giao dịch Đi có Swift entry (r001,r005–r007,r009–r012,r014,r016–r018)
  swift_di: [
    { seq: 16366, trace: '775780', hostdate: '20260201', amount: 10_000_000, status: 'THANH CONG' }, // r001 KHOP
    { seq: 16210, trace: '141135', hostdate: '20260201', amount:    300_000, status: 'THANH CONG' }, // r005 NAPAS_THAT_BAI
    { seq: 16487, trace: '774976', hostdate: '20260201', amount:     11_000, status: 'TIMEOUT'    }, // r006 SWIFT_TIMEOUT
    { seq: 21554, trace: '777794', hostdate: '20260202', amount:  4_800_000, status: 'THANH CONG' }, // r007 KHOP
    { seq: 21240, trace: '777740', hostdate: '20260202', amount: 10_500_000, status: 'THANH CONG' }, // r009 KHOP_LECH_NGAY
    { seq: 21320, trace: '469702', hostdate: '20260202', amount:  2_000_000, status: 'THANH CONG' }, // r010 NAPAS_THAT_BAI
    { seq: 21450, trace: '777779', hostdate: '20260202', amount:    979_000, status: 'TIMEOUT'    }, // r011 TIMEOUT_CO_CORE
    { seq: 21834, trace: '777988', hostdate: '20260202', amount:     45_000, status: 'THAT BAI'   }, // r012 SWIFT_THAT_BAI
    { seq: 22773, trace: '781659', hostdate: '20260203', amount:    600_000, status: 'THANH CONG' }, // r014 KHOP
    { seq: 24966, trace: '784930', hostdate: '20260204', amount:  4_000_000, status: 'THANH CONG' }, // r016 KHOP_LECH_NGAY (T+1)
    { seq: 23735, trace: '781475', hostdate: '20260203', amount:  9_900_000, status: 'TIMEOUT'    }, // r017 TIMEOUT_CO_CORE
    { seq: 23741, trace: '781481', hostdate: '20260203', amount: 20_000_000, status: 'THANH CONG' }, // r018 CHI_SWIFT
  ],
  // 6 giao dịch Đến có Swift entry (r002–r004, r008, r015, r019)
  swift_den: [
    { seq: 99158, trace: '049517', hostdate: '20260202', amount:  2_000_000, status: 'THANH CONG' }, // r002 KHOP_LECH_NGAY (HOST DATE T+1)
    { seq: 16401, trace: '885375', hostdate: '20260201', amount:    148_000, status: 'THANH CONG' }, // r003 KHOP
    { seq: 15980, trace: '768974', hostdate: '20260201', amount:    320_000, status: 'THANH CONG' }, // r004 KHOP_LECH_NGAY
    { seq: 20001, trace: '710295', hostdate: '20260202', amount: 18_000_000, status: 'THANH CONG' }, // r008 KHOP
    { seq: 23010, trace: '352641', hostdate: '20260203', amount:    150_000, status: 'THANH CONG' }, // r015 KHOP
    { seq: 23901, trace: '465211', hostdate: '20260203', amount: 39_100_000, status: 'TIMEOUT'    }, // r019 NGOAI_LE
  ],
  // Core Ghi có = chiều Đi đã được Core ghi nhận (r001,r007,r009,r011,r014,r016,r017)
  core_ghico: [
    { trace: '775780', hostdate: '20260201', amount: 10_000_000, dien_giai: '"06800-5071-16366 TRANSFER CREDMBNEO.8165321.775780', ngay_hach_toan: '20260201' },
    { trace: '777794', hostdate: '20260202', amount:  4_800_000, dien_giai: '"06800-5071-21554 TRANSFER CREDMBNEO.8165322.777794', ngay_hach_toan: '20260202' },
    { trace: '777740', hostdate: '20260202', amount: 10_500_000, dien_giai: '"06800-5071-21240 TRANSFER CREDMBNEO.8165323.777740', ngay_hach_toan: '20260202' },
    { trace: '777779', hostdate: '20260202', amount:    979_000, dien_giai: '"06800-5071-21450 TRANSFER CREDMBNEO.8165324.777779', ngay_hach_toan: '20260202' },
    { trace: '781659', hostdate: '20260203', amount:    600_000, dien_giai: '"06800-5071-22773 TRANSFER CREDMBNEO.8165325.781659', ngay_hach_toan: '20260203' },
    { trace: '784930', hostdate: '20260204', amount:  4_000_000, dien_giai: '"06800-5071-24966 TRANSFER CREDMBNEO.8165326.784930', ngay_hach_toan: '20260204' },
    { trace: '781475', hostdate: '20260203', amount:  9_900_000, dien_giai: '"06800-5071-23735 TRANSFER CREDMBNEO.8165327.781475', ngay_hach_toan: '20260203' },
  ],
  // Core Ghi nợ = chiều Đến đã được Core ghi nhận (r002–r004, r008, r015, r019)
  core_ghino: [
    { trace: '049517', hostdate: '20260202', amount:  2_000_000, dien_giai: '"06800-5071-99158 TRANSFER CREDMBNEO.8165401.049517', ngay_hach_toan: '20260202' },
    { trace: '885375', hostdate: '20260201', amount:    148_000, dien_giai: '"06800-5071-16401 TRANSFER CREDMBNEO.8165402.885375', ngay_hach_toan: '20260201' },
    { trace: '768974', hostdate: '20260201', amount:    320_000, dien_giai: '"06800-5071-15980 TRANSFER CREDMBNEO.8165403.768974', ngay_hach_toan: '20260201' },
    { trace: '710295', hostdate: '20260202', amount: 18_000_000, dien_giai: '"06800-5071-20001 TRANSFER CREDMBNEO.8165404.710295', ngay_hach_toan: '20260202' },
    { trace: '352641', hostdate: '20260203', amount:    150_000, dien_giai: '"06800-5071-23010 TRANSFER CREDMBNEO.8165405.352641', ngay_hach_toan: '20260203' },
    { trace: '465211', hostdate: '20260203', amount: 39_100_000, dien_giai: '"06800-5071-23901 TRANSFER CREDMBNEO.8165406.465211', ngay_hach_toan: '20260203' },
  ],
  // NAPAS Đi TC: r001,r007,r009,r011,r014,r016,r017 (r009 Ngày GD=T-1; r011/r017 TIMEOUT_CO_CORE nhưng NAPAS có)
  napas_di: [
    { trace: '775780', ngay_gd: '20260201', amount: 10_000_000, ma_ngan_hang: '970423', trang_thai: 'THANH CONG' },
    { trace: '777794', ngay_gd: '20260202', amount:  4_800_000, ma_ngan_hang: '970415', trang_thai: 'THANH CONG' },
    { trace: '777740', ngay_gd: '20260201', amount: 10_500_000, ma_ngan_hang: '970436', trang_thai: 'THANH CONG' }, // Ngày GD T-1
    { trace: '777779', ngay_gd: '20260202', amount:    979_000, ma_ngan_hang: '970448', trang_thai: 'THANH CONG' },
    { trace: '781659', ngay_gd: '20260203', amount:    600_000, ma_ngan_hang: '970407', trang_thai: 'THANH CONG' },
    { trace: '784930', ngay_gd: '20260203', amount:  4_000_000, ma_ngan_hang: '970423', trang_thai: 'THANH CONG' }, // Swift T+1
    { trace: '781475', ngay_gd: '20260203', amount:  9_900_000, ma_ngan_hang: '970416', trang_thai: 'THANH CONG' },
  ],
  // NAPAS Đến TC: r002–r004, r008, r013(CHI_NAPAS), r015; r019 NGOAI_LE (Ngày GD T-1, thất bại)
  napas_den: [
    { trace: '049517', ngay_gd: '20260201', amount:  2_000_000, ma_ngan_hang: '970418', trang_thai: 'THANH CONG' }, // r002 KHOP_LECH_NGAY
    { trace: '885375', ngay_gd: '20260201', amount:    148_000, ma_ngan_hang: '970416', trang_thai: 'THANH CONG' }, // r003 KHOP
    { trace: '768974', ngay_gd: '20260131', amount:    320_000, ma_ngan_hang: '970432', trang_thai: 'THANH CONG' }, // r004 KHOP_LECH_NGAY (QT, Ngày GD T-1)
    { trace: '710295', ngay_gd: '20260202', amount: 18_000_000, ma_ngan_hang: '970407', trang_thai: 'THANH CONG' }, // r008 KHOP
    { trace: '786548', ngay_gd: '20260201', amount:  1_000_000, ma_ngan_hang: '970420', trang_thai: 'THANH CONG' }, // r013 CHI_NAPAS (không có Swift/Core)
    { trace: '352641', ngay_gd: '20260203', amount:    150_000, ma_ngan_hang: '970415', trang_thai: 'THANH CONG' }, // r015 KHOP
    { trace: '465211', ngay_gd: '20260202', amount: 39_100_000, ma_ngan_hang: '970453', trang_thai: 'THAT BAI'  }, // r019 NGOAI_LE (Ngày GD T-1, failed)
  ],
  // KTC Đi (Không Thành Công): r005, r010
  napas_di_fail: [
    { trace: '141135', ngay_gd: '20260201', amount:   300_000, ly_do: 'Lỗi xử lý giao dịch' },    // r005
    { trace: '469702', ngay_gd: '20260202', amount: 2_000_000, ly_do: 'Ngân hàng nhận từ chối' }, // r010
  ],
}

export default function DataStorage() {
  const [fileStatus, setFileStatus] = useState(null)

  const refreshStatus = () => api.getStatus().then(setFileStatus).catch(() => {})

  useEffect(() => { refreshStatus() }, [])

  return (
    <PageShell title="Kho dữ liệu" subtitle="Dữ liệu thô đã trích xuất từ 3 nguồn. Kết quả đối soát và master giao dịch xem tại trang Đối soát.">
      <FileStatusBanner status={fileStatus} />
      <RawDataTab fileStatus={fileStatus} onRefresh={refreshStatus} />
    </PageShell>
  )
}

function FileStatusBanner({ status }) {
  if (!status) return null
  const slots = Object.entries(status)
  const present = slots.filter(([, v]) => v.exists).length
  const total   = slots.length
  const allOk   = present === total

  const SLOT_LABELS = {
    swift_di:      'Swift Đi',
    swift_den:     'Swift Đến',
    core:          'Core',
    napas_di:      'Napas Đi',
    napas_den:     'Napas Đến',
    napas_di_fail: 'Napas KTC',
  }

  return (
    <div style={{ marginBottom: 16, padding: '12px 16px', background: allOk ? '#f0fdf4' : '#fffbeb', border: `1px solid ${allOk ? '#bbf7d0' : '#fde68a'}`, borderRadius: 8, fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: allOk ? '#059669' : '#d97706' }}>
          {allOk ? `Đủ ${total} file ·` : `${present}/${total} file ·`}
        </span>
        {slots.map(([slot, v]) => (
          <span key={slot} style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: v.exists ? '#dcfce7' : '#fee2e2',
            color: v.exists ? '#166534' : '#dc2626',
            border: `1px solid ${v.exists ? '#bbf7d0' : '#fecaca'}`,
          }}>
            {SLOT_LABELS[slot] ?? slot}
            {v.exists && v.sheets ? ` (${v.sheets.length} ngày)` : v.exists ? '' : ' — chưa tải'}
          </span>
        ))}
      </div>
    </div>
  )
}

function RawDataTab({ fileStatus, onRefresh }) {
  const [activeTableId, setActiveTableId] = useState('swift')
  const [activeSubtabs, setActiveSubtabs] = useState({ swift: 'swift_di', core: 'core_ghico', napas: 'napas_di' })
  const [search, setSearch]               = useState('')
  const [filterStatus, setFS]             = useState('')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')

  const table    = RAW_TABLES.find(t => t.id === activeTableId)
  const subtabId = activeSubtabs[activeTableId]
  const subtab   = table.subtabs.find(s => s.id === subtabId)
  const rows     = RAW_MOCK[subtabId] ?? []
  const cols     = subtab?.cols ?? []

  const setSubtab  = (tableId, subId) => setActiveSubtabs(p => ({ ...p, [tableId]: subId }))
  const hasStatus  = cols.some(c => STATUS_COLS.includes(c))
  const hasDateCol = cols.find(c => DATE_COLS.includes(c))
  const toNum      = (s) => s.replace(/-/g, '')

  const filtered = rows.filter(row => {
    if (search && !Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase()))) return false
    if (filterStatus) {
      const sv = row.status ?? row.trang_thai ?? ''
      if (sv !== filterStatus) return false
    }
    if (hasDateCol) {
      const dv = row[hasDateCol] ?? ''
      if (dateFrom && dv < toNum(dateFrom)) return false
      if (dateTo   && dv > toNum(dateTo))   return false
    }
    return true
  })

  const totalRows = table.subtabs.reduce((s, t) => s + t.rows, 0)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {RAW_TABLES.map(t => {
          const total  = t.subtabs.reduce((s, x) => s + x.rows, 0)
          const active = activeTableId === t.id
          return (
            <div key={t.id} onClick={() => setActiveTableId(t.id)} style={{ padding: '16px 20px', background: active ? t.bg : '#fff', border: `2px solid ${active ? t.color : C.cardBorder}`, borderRadius: radius.lg, cursor: 'pointer', boxShadow: active ? shadow.md : shadow.sm, transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: active ? t.color : C.text }}>{t.name}</span>
                {active && <Badge variant="primary">Đang xem</Badge>}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: active ? t.color : C.text, marginBottom: 2 }}>{total.toLocaleString()}</div>
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

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.neutralBg }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: table.color }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{table.name}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{totalRows.toLocaleString()} bản ghi tổng · cập nhật {subtab?.lastUpdate}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {fileStatus && (() => {
              const slotMap = { swift: ['swift_di','swift_den'], core: ['core'], napas: ['napas_di','napas_den','napas_di_fail'] }
              const slots = slotMap[activeTableId] ?? []
              const anyMissing = slots.some(s => fileStatus[s] && !fileStatus[s].exists)
              return anyMissing
                ? <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Chưa đủ file</span>
                : <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>File OK</span>
            })()}
            <Button size="sm" variant="ghost">Xuất CSV</Button>
            <Button size="sm" variant="subtle" onClick={onRefresh}>Làm mới</Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: `1px solid ${C.cardBorder}` }}>
          {table.subtabs.map(s => {
            const active = s.id === subtabId
            return (
              <button key={s.id} onClick={() => setSubtab(activeTableId, s.id)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: active ? 600 : 500, cursor: 'pointer', background: active ? table.color : 'transparent', color: active ? '#fff' : C.textMuted, border: active ? 'none' : `1px solid ${C.cardBorder}`, transition: 'all 0.12s' }}>
                {s.label} <span style={{ marginLeft: 4, opacity: 0.8, fontSize: 11 }}>({s.rows.toLocaleString()})</span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.cardBorder}`, flexWrap: 'wrap' }}>
          <Input placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          {hasDateCol && (
            <>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 140 }} />
              <span style={{ display: 'flex', alignItems: 'center', color: C.textMuted, fontSize: 12 }}>–</span>
              <Input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ width: 140 }} />
            </>
          )}
          {hasStatus && (
            <Select value={filterStatus} onChange={e => setFS(e.target.value)} style={{ width: 170 }}>
              <option value="">Tất cả trạng thái</option>
              <option value="THANH CONG">Thành công</option>
              <option value="TIMEOUT">Timeout</option>
              <option value="THAT BAI">Thất bại</option>
            </Select>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                    {COL_LABELS[c] ?? c.replace(/_/g, ' ')}
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
                        ? statusText(row[c])
                        : AMOUNT_COLS.includes(c)
                        ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{Number(row[c]).toLocaleString('vi-VN')} ₫</span>
                        : DATE_COLS.includes(c)
                        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{formatDate(row[c])}</span>
                        : <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{row[c]}</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={cols.length} style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>Không tìm thấy bản ghi</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', fontSize: 12, color: C.textMuted, borderTop: `1px solid ${C.cardBorder}` }}>
          Hiển thị <b>{filtered.length}</b> / {rows.length} bản ghi mẫu · Tổng trong bảng: {subtab?.rows.toLocaleString()}
        </div>
      </div>
    </>
  )
}
