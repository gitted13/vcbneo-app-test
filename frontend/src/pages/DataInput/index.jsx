import { useState, useRef } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Tabs from '../../components/Tabs'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import { C, radius, shadow } from '../../theme'

const FILE_TYPES = [
  { id: 'swift_di',      name: 'Swift Report Đi',         color: '#2563eb' },
  { id: 'swift_den',     name: 'Swift Report Đến',        color: '#7c3aed' },
  { id: 'core',          name: 'Core (Ghi có / Ghi nợ)', color: '#059669' },
  { id: 'napas_di',      name: 'Napas Đi',                color: '#d97706' },
  { id: 'napas_den',     name: 'Napas Đến',               color: '#dc2626' },
  { id: 'napas_di_fail', name: 'Napas Đi Thất bại',      color: '#64748b' },
]

const MOCK_RPA_RUNS = [
  { id: 'RPA-0044', time: '2026-02-05 06:00', files: 6, ok: 6, status: 'success', trigger: 'Tự động',  duration: '2m 18s' },
  { id: 'RPA-0043', time: '2026-02-04 06:00', files: 6, ok: 5, status: 'warning', trigger: 'Tự động',  duration: '2m 41s' },
  { id: 'RPA-0042', time: '2026-02-03 06:00', files: 6, ok: 6, status: 'success', trigger: 'Thủ công', duration: '1m 59s' },
  { id: 'RPA-0041', time: '2026-02-02 06:01', files: 6, ok: 3, status: 'error',   trigger: 'Tự động',  duration: '3m 05s' },
]

const MOCK_RPA_STATUS = {
  isRunning: false,
  lastRunId: 'RPA-0044',
  nextScheduled: '2026-02-06 06:00',
  host: '\\\\rpa-server\\vcbneo',
  process: 'VCBNeo_NAPAS_Reconcile',
  uptime: '99.2%',
}

export default function DataInput() {
  return (
    <PageShell
      title="Nhập dữ liệu"
      subtitle="Tải file thủ công hoặc theo dõi kết quả từ RPA. File sẽ được kiểm tra theo cấu hình loại file."
    >
      <Tabs tabs={['Tải thủ công', 'RPA']}>
        <ManualTab />
        <RPATab status={MOCK_RPA_STATUS} runs={MOCK_RPA_RUNS} />
      </Tabs>
    </PageShell>
  )
}

/* ── Manual Tab ─────────────────────────────────────────────────────────────── */
function ManualTab() {
  const [files, setFiles] = useState({})

  const handleDrop = (id, f) => {
    const valid = Math.random() > 0.2
    setFiles(prev => ({
      ...prev,
      [id]: { name: f.name, size: f.size, valid, error: valid ? null : 'Không tìm thấy cột bắt buộc: HOSTDATE' }
    }))
  }

  const uploaded = Object.values(files).filter(f => f.valid).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: C.textMuted }}>
          <span style={{ fontWeight: 600, color: uploaded === FILE_TYPES.length ? C.success : C.text }}>{uploaded}</span>
          <span> / {FILE_TYPES.length} file hợp lệ</span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="ghost" onClick={() => setFiles({})}>Xóa tất cả</Button>
          <Button size="sm" disabled={uploaded < FILE_TYPES.length}>Lưu &amp; Trích xuất</Button>
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

  const handleChange = (e) => { if (e.target.files?.[0]) onDrop(e.target.files[0]); e.target.value = '' }
  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleDropEvt   = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) onDrop(e.dataTransfer.files[0]) }

  const hasFile = !!fileInfo
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
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Định dạng: .xlsx / .xls</div>
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

/* ── RPA Observe Tab ────────────────────────────────────────────────────────── */
function RPATab({ status, runs }) {
  const statusBadge = (s) => ({ success: 'success', warning: 'warning', error: 'error' }[s] ?? 'neutral')
  const statusLabel = (s) => ({ success: 'Thành công', warning: 'Thiếu file', error: 'Thất bại' }[s] ?? s)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Live status banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '16px 24px',
        background: status.isRunning
          ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
          : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: `1px solid ${status.isRunning ? '#bfdbfe' : '#bbf7d0'}`,
        borderRadius: radius.lg,
        boxShadow: shadow.sm,
      }}>
        {/* Pulse dot */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: status.isRunning ? C.primary : C.success,
          }} />
          {status.isRunning && (
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: `2px solid ${C.primary}`, opacity: 0.4,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>
            {status.isRunning ? 'RPA đang chạy...' : 'RPA đang chờ – lần chạy tiếp theo đã lên lịch'}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Host: <code style={{ color: C.primary, fontFamily: 'monospace' }}>{status.host}</code></span>
            <span>Process: <code style={{ color: C.text, fontFamily: 'monospace' }}>{status.process}</code></span>
            <span>Uptime: <b style={{ color: C.success }}>{status.uptime}</b></span>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Lần chạy tiếp theo</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{status.nextScheduled}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button size="sm" variant="ghost">Mở RPA Console</Button>
          <Button size="sm" variant="ghost" style={{ color: C.primary }}>Xem log hệ thống</Button>
        </div>
      </div>

      {/* Last run summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Run ID gần nhất',   val: status.lastRunId,             color: C.primary,  bg: '#eff6ff' },
          { label: 'Tổng lần chạy',     val: runs.length,                  color: C.text,     bg: C.neutralBg },
          { label: 'Thành công',         val: runs.filter(r => r.status === 'success').length, color: C.success, bg: '#f0fdf4' },
          { label: 'Có lỗi / thiếu',    val: runs.filter(r => r.status !== 'success').length, color: C.error,   bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', background: s.bg, border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* History table */}
      <Card title="Lịch sử chạy RPA" subtitle="Chỉ đọc – cấu hình RPA thực hiện trong module Cài đặt ứng dụng" noPad>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Run ID', 'Trigger', 'Thời gian', 'Thời lượng', 'File nhận', 'Kết quả', ''].map(h => (
                <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 ? C.neutralBg : '#fff' }}>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: C.primary, fontWeight: 600 }}>{r.id}</td>
                <td style={{ padding: '10px 16px', color: C.textMuted }}>{r.trigger}</td>
                <td style={{ padding: '10px 16px', color: C.textMuted, whiteSpace: 'nowrap' }}>{r.time}</td>
                <td style={{ padding: '10px 16px', color: C.textMuted }}>{r.duration}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontWeight: 600 }}>{r.ok}</span>
                  <span style={{ color: C.textMuted }}> / {r.files} file</span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <Badge variant={statusBadge(r.status)} dot>{statusLabel(r.status)}</Badge>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <Button size="sm" variant="ghost">Chi tiết</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
