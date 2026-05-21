import { useState, useRef } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'

const FILE_TYPES = [
  { id: 'swift_di',      name: 'Swift Report Đi',         color: '#2563eb' },
  { id: 'swift_den',     name: 'Swift Report Đến',        color: '#7c3aed' },
  { id: 'core',          name: 'Core (Ghi có / Ghi nợ)', color: '#059669' },
  { id: 'napas_di',      name: 'Napas Đi',                color: '#d97706' },
  { id: 'napas_den',     name: 'Napas Đến',               color: '#dc2626' },
  { id: 'napas_di_fail', name: 'Napas Đi Không thành công', color: '#64748b', optional: true },
]

const FILE_TYPE_COLORS = {
  'Swift Report Đi':            '#2563eb',
  'Swift Report Đến':           '#7c3aed',
  'Core (Ghi có / Ghi nợ)':    '#059669',
  'Napas Đi':                   '#d97706',
  'Napas Đến':                  '#dc2626',
  'Napas Đi Không thành công':  '#64748b',
}

const HISTORY_ROWS = [
  { id: 1,  time: '2026-02-05 08:14', type: 'Swift Report Đi',        file: 'Swift_report_di_20260205.xlsx',   source: 'Thủ công', user: 'admin',  valid: true,  size: '1.2 MB', rows: 8381  },
  { id: 2,  time: '2026-02-05 08:14', type: 'Swift Report Đến',       file: 'Swift_report_den_20260205.xlsx',  source: 'Thủ công', user: 'admin',  valid: true,  size: '0.8 MB', rows: 6104  },
  { id: 3,  time: '2026-02-05 06:00', type: 'Napas Đi',               file: 'Napas_di_20260205.xlsx',          source: 'RPA-0044', user: 'system', valid: true,  size: '2.1 MB', rows: 9381  },
  { id: 4,  time: '2026-02-05 06:00', type: 'Napas Đến',              file: 'Napas_den_20260205.xlsx',         source: 'RPA-0044', user: 'system', valid: true,  size: '1.4 MB', rows: 5086  },
  { id: 5,  time: '2026-02-05 06:00', type: 'Core (Ghi có / Ghi nợ)', file: 'Core_20260205.xlsx',              source: 'RPA-0044', user: 'system', valid: true,  size: '3.6 MB', rows: 12231 },
  { id: 6,  time: '2026-02-04 06:01', type: 'Napas Đi Không thành công', file: 'Napas_KTC_20260204.xlsx',       source: 'RPA-0043', user: 'system', valid: false, size: '0.2 MB', rows: 0,    error: 'Thiếu cột bắt buộc: Số tiền' },
  { id: 7,  time: '2026-02-04 08:30', type: 'Swift Report Đi',        file: 'Swift_report_di_20260204.xlsx',   source: 'Thủ công', user: 'user1',  valid: true,  size: '1.1 MB', rows: 8012  },
  { id: 8,  time: '2026-02-03 06:00', type: 'Napas Đi',               file: 'Napas_di_20260203.xlsx',          source: 'RPA-0042', user: 'system', valid: true,  size: '1.9 MB', rows: 8944  },
]

const EXTRACTED_SUMMARY = [
  { group: 'Swift',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', items: [{ label: 'Swift Đi', rows: 8381 }, { label: 'Swift Đến', rows: 6104 }] },
  { group: 'Core',   color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', items: [{ label: 'Ghi có', rows: 6842 }, { label: 'Ghi nợ', rows: 5389 }] },
  { group: 'NAPAS',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', items: [{ label: 'Đi', rows: 9381 }, { label: 'Đến', rows: 5086 }, { label: 'Thất bại', rows: 21 }] },
]

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 20 }}>
      {tabs.map((tab, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            padding: '10px 20px', border: 'none', background: 'none',
            borderBottom: active === i ? `2px solid ${C.primary}` : '2px solid transparent',
            color: active === i ? C.primary : C.textMuted,
            fontWeight: active === i ? 700 : 500,
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.12s', marginBottom: -1,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export default function DataInput() {
  const [activeTab, setActiveTab] = useState(0)
  const TABS = ['Tải lên thủ công', 'Lịch sử tải lên']

  return (
    <PageShell
      title="Tải lên dữ liệu"
      subtitle="Tải file thủ công hoặc xem lịch sử nạp dữ liệu. File sẽ được kiểm tra theo cấu hình loại file."
    >
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === 0 ? <ManualTab /> : <HistoryTab />}
    </PageShell>
  )
}

/* ── Manual Tab ──────────────────────────────────────────────────────────────── */
function ManualTab() {
  const { toast } = useApp()
  const [files, setFiles]   = useState({})
  const [saving, setSaving] = useState(false)

  const handleDrop = (id, f) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      setFiles(prev => ({ ...prev, [id]: { name: f.name, size: f.size, valid: false, error: 'Chỉ chấp nhận file .xlsx hoặc .xls', file: null } }))
      return
    }
    setFiles(prev => ({ ...prev, [id]: { name: f.name, size: f.size, valid: true, error: null, file: f } }))
  }

  const requiredUploaded = FILE_TYPES.filter(ft => !ft.optional).every(ft => files[ft.id]?.valid)
  const totalValid       = Object.values(files).filter(f => f.valid).length

  const handleSave = async () => {
    setSaving(true)
    const validSlots = FILE_TYPES.filter(ft => files[ft.id]?.valid && files[ft.id]?.file)
    const errors = []
    let successCount = 0

    for (const ft of validSlots) {
      try {
        await api.upload(ft.id, files[ft.id].file)
        successCount++
      } catch (e) {
        errors.push(`${ft.name}: ${e.message}`)
      }
    }

    setSaving(false)
    if (errors.length === 0) {
      toast(`Đã tải lên ${successCount} file thành công.`, 'success')
      setFiles({})
    } else {
      toast(`${successCount} file thành công. Lỗi: ${errors.join(' · ')}`, 'error')
    }
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: radius.md, fontSize: 13, color: '#1e40af' }}>
        Sử dụng cấu hình loại file từ trang <b>Cấu hình</b> để xác định định dạng và trường dữ liệu hợp lệ.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: C.textMuted }}>
          <span style={{ fontWeight: 600, color: requiredUploaded ? C.success : C.text }}>{totalValid}</span>
          <span> / {FILE_TYPES.length} file hợp lệ</span>
          {requiredUploaded && <span style={{ color: C.success, marginLeft: 8 }}>· Đủ file bắt buộc</span>}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="ghost" onClick={() => setFiles({})}>Xóa tất cả</Button>
          <Button size="sm" disabled={!requiredUploaded || saving} onClick={handleSave}>
            {saving
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Spinner />Đang xử lý...</span>
              : 'Lưu & Trích xuất'
            }
          </Button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {FILE_TYPES.map(ft => (
          <UploadSlot key={ft.id} ft={ft} fileInfo={files[ft.id]} onDrop={(f) => handleDrop(ft.id, f)} />
        ))}
      </div>
    </div>
  )
}

function UploadSlot({ ft, fileInfo, onDrop }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  const handleChange    = (e) => { if (e.target.files?.[0]) onDrop(e.target.files[0]); e.target.value = '' }
  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = ()  => setDragging(false)
  const handleDropEvt   = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) onDrop(e.dataTransfer.files[0]) }

  const hasFile     = !!fileInfo
  const borderColor = dragging ? C.primary : hasFile ? (fileInfo.valid ? C.success : C.error) : C.cardBorder
  const bgColor     = dragging ? C.primaryLight : hasFile ? (fileInfo.valid ? C.successBg : C.errorBg) : '#fafafa'

  return (
    <div
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDropEvt}
      onClick={() => inputRef.current.click()}
      style={{ border: `2px dashed ${borderColor}`, borderRadius: radius.lg, padding: '20px 16px', background: bgColor, transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer' }}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleChange} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: ft.color, flexShrink: 0, marginTop: 3 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ft.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            .xlsx / .xls{ft.optional && <span style={{ color: C.textLight, marginLeft: 6 }}>(Tùy chọn)</span>}
          </div>
        </div>
        {hasFile && <Badge variant={fileInfo.valid ? 'success' : 'error'} dot>{fileInfo.valid ? 'Hợp lệ' : 'Lỗi'}</Badge>}
      </div>
      {hasFile ? (
        <div style={{ fontSize: 12, color: C.textMuted }}>
          <div style={{ fontWeight: 500, color: C.text, marginBottom: 2 }}>{fileInfo.name}</div>
          <div>{(fileInfo.size / 1024).toFixed(0)} KB</div>
          {fileInfo.error && (
            <div style={{ color: C.error, marginTop: 6, padding: '6px 8px', background: C.errorBg, borderRadius: 5, border: `1px solid ${C.errorBorder}` }}>
              {fileInfo.error}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.textLight, textAlign: 'center', paddingTop: 6 }}>
          Kéo file vào đây hoặc nhấn để chọn
        </div>
      )}
    </div>
  )
}

/* ── History Tab ─────────────────────────────────────────────────────────────── */
function HistoryTab() {
  const [sourceFilter, setSourceFilter] = useState('all')
  const [filterType, setFilterType]     = useState('')
  const [filterValid, setFilterValid]   = useState('')
  const [search, setSearch]             = useState('')

  const types    = [...new Set(HISTORY_ROWS.map(r => r.type))]
  const filtered = HISTORY_ROWS.filter(r => {
    if (sourceFilter === 'manual' && r.source !== 'Thủ công') return false
    if (sourceFilter === 'rpa'    && !r.source.startsWith('RPA')) return false
    if (filterType && r.type !== filterType) return false
    if (filterValid === 'valid'   && !r.valid) return false
    if (filterValid === 'invalid' && r.valid)  return false
    if (search && !r.file.toLowerCase().includes(search.toLowerCase()) && !r.type.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredSrc = (src) => {
    if (sourceFilter === 'manual') return src === 'Thủ công'
    if (sourceFilter === 'rpa')    return src.startsWith('RPA')
    return true
  }

  const stats = [
    { label: 'Tổng file',  val: HISTORY_ROWS.filter(r => filteredSrc(r.source)).length, color: C.primary, bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '#bfdbfe' },
    { label: 'Hợp lệ',    val: HISTORY_ROWS.filter(r => filteredSrc(r.source) && r.valid).length, color: C.success, bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#bbf7d0' },
    { label: 'Lỗi',       val: HISTORY_ROWS.filter(r => filteredSrc(r.source) && !r.valid).length, color: C.error, bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fecaca' },
    { label: 'Tự động',   val: HISTORY_ROWS.filter(r => r.source.startsWith('RPA')).length, color: '#d97706', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '#fde68a' },
    { label: 'Thủ công',  val: HISTORY_ROWS.filter(r => r.source === 'Thủ công').length, color: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '#c4b5fd' },
  ]

  return (
    <div>
      {/* Source filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'all',    label: 'Tất cả nguồn' },
          { key: 'manual', label: 'Thủ công' },
          { key: 'rpa',    label: 'Tự động' },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => setSourceFilter(opt.key)}
            style={{
              padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: sourceFilter === opt.key ? 700 : 500, fontFamily: 'inherit',
              background: sourceFilter === opt.key ? C.primary : C.neutralBg,
              color:      sourceFilter === opt.key ? '#fff' : C.textMuted,
              boxShadow:  sourceFilter === opt.key ? shadow.sm : 'none',
              transition: 'all 0.12s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.border}`, borderRadius: radius.md, padding: '14px 16px', textAlign: 'center', boxShadow: shadow.sm }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* File history table */}
      <Card noPad>
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${C.cardBorder}`, flexWrap: 'wrap' }}>
          <Input placeholder="Tìm theo tên file, loại..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 200 }}>
            <option value="">Tất cả loại file</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select value={filterValid} onChange={e => setFilterValid(e.target.value)} style={{ width: 150 }}>
            <option value="">Tất cả trạng thái</option>
            <option value="valid">Hợp lệ</option>
            <option value="invalid">Lỗi</option>
          </Select>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Thời gian', 'Loại file', 'Tên file', 'Nguồn', 'Người dùng', 'Dung lượng', 'GD trích xuất', 'Trạng thái', ''].map(h => (
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
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: r.rows ? C.text : C.textLight }}>
                      {r.rows ? r.rows.toLocaleString() : '—'}
                    </td>
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
                        Lỗi: <b>{r.error}</b>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', color: C.textMuted, fontSize: 12, borderTop: `1px solid ${C.cardBorder}` }}>
          Hiển thị <b>{filtered.length}</b> / {HISTORY_ROWS.length} bản ghi
        </div>
      </Card>

      {/* Extracted transactions summary */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>
          Giao dịch đã trích xuất theo loại
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {EXTRACTED_SUMMARY.map(group => (
            <div key={group.group} style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, overflow: 'hidden', boxShadow: shadow.sm }}>
              <div style={{ padding: '10px 16px', background: group.bg, borderBottom: `1px solid ${group.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: group.color }}>{group.group}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                  Tổng: {group.items.reduce((a, b) => a + b.rows, 0).toLocaleString()} GD
                </div>
              </div>
              <div style={{ padding: '10px 16px' }}>
                {group.items.map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${C.cardBorder}` }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: group.color }}>{item.rows.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 12, height: 12,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
