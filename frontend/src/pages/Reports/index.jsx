import { useState, useEffect } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { Input, Select, FormRow } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { C, radius, shadow } from '../../theme'
import { RESOLUTION_OF } from '../../data/reconcile'
import { api } from '../../api/client'

/* ── Mock data (3 ngày 01–03/02/2026, khớp với trang Đối soát) ─────────────── */
const KPI = [
  { label: 'Tổng GD Swift Đi',  val: '5,029', sub: '3 ngày', delta: '+1.2%', up: true,  color: '#2563eb', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '#bfdbfe', icon: '→' },
  { label: 'Tổng GD Swift Đến', val: '3,664', sub: '3 ngày', delta: '+0.9%', up: true,  color: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '#c4b5fd', icon: '←' },
  { label: 'Khớp tự động',      val: '8,013', sub: '/ 8,693', delta: '92.2%', up: true, color: '#059669', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#bbf7d0', icon: '✓' },
  { label: 'Cần xử lý',         val: '680',   sub: 'chờ duyệt', delta: '7.8%', up: false, color: '#dc2626', bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fecaca', icon: '!' },
]

const DAILY_SWIFT = [
  { date: '01/02', di: 1650, den: 1200 },
  { date: '02/02', di: 1688, den: 1246 },
  { date: '03/02', di: 1691, den: 1218 },
]

// Phân tích trạng thái đối soát cho chiều Đi (5,029 GD)
const STATUS_BREAKDOWN = [
  { label: 'Khớp đúng ngày',      count: 4274, pct: 85.0, color: '#059669', bg: '#dcfce7' },
  { label: 'Khớp lệch ngày',      count:  402, pct:  8.0, color: '#0891b2', bg: '#cffafe' },
  { label: 'NAPAS thất bại',       count:  101, pct:  2.0, color: '#dc2626', bg: '#fee2e2' },
  { label: 'Timeout – có Core',    count:  101, pct:  2.0, color: '#d97706', bg: '#fef3c7' },
  { label: 'Cần xử lý thủ công',   count:  151, pct:  3.0, color: '#7c3aed', bg: '#ede9fe' },
]

const INITIAL_REPORTS = [
  {
    id: 'rpt_001',
    name: 'Bảng tổng hợp ĐI – Đối chiếu NAPAS',
    sourceLogic: 'jl_001', sourceName: 'Swift Đi ↔ NAPAS Đi',
    lastGenerated: '2026-02-03 09:05', format: 'Excel (.xls)',
    sections: ['Tiêu đề ngân hàng', 'Swift count / amount', 'Core Ghi có ngày T', 'Core Ghi có ngày T+1', 'NAPAS Đi TC ngày T', 'Chênh lệch / GD lỗi'],
    status: 'ready',
  },
  {
    id: 'rpt_002',
    name: 'Bảng tổng hợp ĐẾN – Đối chiếu NAPAS',
    sourceLogic: 'jl_002', sourceName: 'Swift Đến ↔ NAPAS Đến',
    lastGenerated: '2026-02-03 09:06', format: 'Excel (.xls)',
    sections: ['Tiêu đề ngân hàng', 'Swift count / amount', 'Core Ghi nợ ngày T', 'NAPAS Đến TC ngày T', 'GD Timeout / Ngoại lệ'],
    status: 'ready',
  },
  {
    id: 'rpt_003',
    name: 'Danh sách ĐI lỗi – NAPAS thất bại',
    sourceLogic: 'jl_001', sourceName: 'Swift Đi ↔ NAPAS Đi',
    lastGenerated: '2026-02-03 09:08', format: 'Excel (.xls)',
    sections: ['Ngày phát sinh', 'Trace', 'Số tiền', 'Trạng thái Swift', 'Lý do NAPAS từ chối', 'Hướng xử lý'],
    status: 'ready',
  },
  {
    id: 'rpt_004',
    name: 'Danh sách cần xử lý thủ công',
    sourceLogic: 'jl_001', sourceName: 'Swift Đi ↔ NAPAS Đi',
    lastGenerated: null, format: 'Excel (.xls)',
    sections: ['Ngày phát sinh', 'Trace', 'Số tiền', 'Trạng thái đối soát', 'Hướng xử lý', 'Người phụ trách'],
    status: 'idle',
  },
]

const LOGICS = [
  { id: 'jl_001', name: 'Swift Đi ↔ NAPAS Đi' },
  { id: 'jl_002', name: 'Swift Đến ↔ NAPAS Đến' },
  { id: 'jl_003', name: 'Swift Đi ↔ Core (Ghi có)' },
  { id: 'jl_004', name: 'Swift Đến ↔ Core (Ghi nợ)' },
  { id: 'jl_005', name: 'Core ↔ NAPAS Đi (cross-check)' },
  { id: 'jl_006', name: 'Core ↔ NAPAS Đến (cross-check)' },
]

const maxBar = Math.max(...DAILY_SWIFT.map(d => Math.max(d.di, d.den)))

export default function Reports() {
  const { showConfirm, toast } = useApp()
  const [reports, setReports] = useState(INITIAL_REPORTS)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [activeDate, setActiveDate] = useState('03/02')
  const [liveRows, setLiveRows] = useState([])

  useEffect(() => {
    api.getRows().then(res => setLiveRows(res.rows ?? [])).catch(() => {})
  }, [])

  const chiSwift   = liveRows.filter(r => r.recon_status === 'CHI_SWIFT')
  const chiNapas   = liveRows.filter(r => r.recon_status === 'CHI_NAPAS')
  const chiCore    = liveRows.filter(r => r.recon_status === 'CHI_CORE')
  const needsAct   = liveRows.filter(r => RESOLUTION_OF[r.recon_status]?.needsAction && !r.resolved_by)
  const totalAlert = chiSwift.length + chiNapas.length + chiCore.length

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit   = (r)  => { setEditing(r);  setFormOpen(true) }
  const deleteItem = (id, name) => showConfirm({
    title: 'Xóa báo cáo',
    message: `Xóa "${name}" sẽ không thể khôi phục.`,
    variant: 'danger',
    confirmLabel: 'Xóa',
    onConfirm: () => {
      setReports(p => p.filter(r => r.id !== id))
      toast(`Đã xóa báo cáo "${name}".`, 'success')
    },
  })

  return (
    <PageShell
      title="Dashboard"
      subtitle="Tổng quan kết quả đối soát · Ngân hàng TM TNHH MTV Xây dựng Việt Nam"
      actions={<Button onClick={openCreate}>+ Tạo báo cáo mới</Button>}
    >
      {/* ── KPI row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {KPI.map(k => (
          <div key={k.label} style={{ padding: '18px 20px', background: k.bg, border: `1px solid ${k.border}`, borderRadius: radius.lg, boxShadow: shadow.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: k.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: k.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 6 }}>{k.val}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>{k.sub}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: k.up ? C.success : C.error, padding: '1px 6px', background: k.up ? '#dcfce7' : '#fee2e2', borderRadius: 4 }}>{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alerts row ── */}
      {(totalAlert > 0 || needsAct.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
          {chiSwift.length > 0 && (
            <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: radius.lg, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>!</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{chiSwift.length}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9b1c1c', marginTop: 3 }}>Chỉ Swift — không khớp Core/NAPAS</div>
                <div style={{ fontSize: 10, color: '#9b1c1c', marginTop: 1 }}>Kiểm tra thủ công, liên hệ Core team</div>
              </div>
            </div>
          )}
          {chiNapas.length > 0 && (
            <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: radius.lg, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>!</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{chiNapas.length}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9b1c1c', marginTop: 3 }}>Chỉ NAPAS — không khớp Swift/Core</div>
                <div style={{ fontSize: 10, color: '#9b1c1c', marginTop: 1 }}>Liên hệ NAPAS tra cứu giao dịch</div>
              </div>
            </div>
          )}
          {chiCore.length > 0 && (
            <div style={{ padding: '14px 18px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: radius.lg, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>!</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>{chiCore.length}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95', marginTop: 3 }}>Chỉ Core — không khớp Swift/NAPAS</div>
                <div style={{ fontSize: 10, color: '#4c1d95', marginTop: 1 }}>Có thể là batch NP_TREO — kiểm tra</div>
              </div>
            </div>
          )}
          {needsAct.length > 0 && (
            <div style={{ padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: radius.lg, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>i</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{needsAct.length}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginTop: 3 }}>Cần xử lý thủ công</div>
                <div style={{ fontSize: 10, color: '#92400e', marginTop: 1 }}>Chưa được xác nhận — Operator review</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Bar chart – daily volume */}
        <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Lượng giao dịch 3 ngày gần nhất</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Swift Đi vs Swift Đến · 01–03/02/2026</div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#2563eb', display: 'inline-block' }} />Swift Đi</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#7c3aed', display: 'inline-block' }} />Swift Đến</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 140 }}>
            {DAILY_SWIFT.map(d => (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%', gap: 3 }}>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{
                      width: 18, borderRadius: '3px 3px 0 0', background: d.date === activeDate ? '#1d4ed8' : '#93c5fd',
                      height: `${(d.di / maxBar) * 110}px`, transition: 'height 0.3s', cursor: 'pointer',
                    }} onClick={() => setActiveDate(d.date)} title={`Swift Đi: ${d.di.toLocaleString()}`} />
                    <div style={{
                      width: 18, borderRadius: '3px 3px 0 0', background: d.date === activeDate ? '#7c3aed' : '#c4b5fd',
                      height: `${(d.den / maxBar) * 110}px`, transition: 'height 0.3s', cursor: 'pointer',
                    }} onClick={() => setActiveDate(d.date)} title={`Swift Đến: ${d.den.toLocaleString()}`} />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: d.date === activeDate ? C.primary : C.textMuted, fontWeight: d.date === activeDate ? 700 : 400 }}>{d.date}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '10px 14px', background: C.neutralBg, borderRadius: radius.md, fontSize: 12 }}>
            {(() => {
              const d = DAILY_SWIFT.find(x => x.date === activeDate)
              if (!d) return null
              return (
                <div style={{ display: 'flex', gap: 20 }}>
                  <span><b style={{ color: '#2563eb' }}>{d.di.toLocaleString()}</b> <span style={{ color: C.textMuted }}>Swift Đi</span></span>
                  <span><b style={{ color: '#7c3aed' }}>{d.den.toLocaleString()}</b> <span style={{ color: C.textMuted }}>Swift Đến</span></span>
                  <span><b style={{ color: C.text }}>{(d.di + d.den).toLocaleString()}</b> <span style={{ color: C.textMuted }}>tổng</span></span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Stacked bar – status breakdown */}
        <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Trạng thái đối soát Đi</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>Swift Đi ↔ NAPAS Đi · 5,029 GD · 3 ngày</div>
          <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', marginBottom: 16 }}>
            {STATUS_BREAKDOWN.map(s => (
              <div key={s.label} style={{ width: `${s.pct}%`, background: s.color, transition: 'width 0.4s', minWidth: s.pct > 0.5 ? 4 : 0 }} title={`${s.label}: ${s.pct}%`} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STATUS_BREAKDOWN.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12, color: C.text }}>{s.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.count.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: C.textMuted, minWidth: 36, textAlign: 'right' }}>{s.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Napas match summary table ── */}
      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Tổng hợp đối soát</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>So sánh giữa Swift, Core và NAPAS</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Luồng', 'Swift count', 'Swift amount', 'Core ngày T', 'Core ngày T+1', 'NAPAS count', 'NAPAS amount', 'Chênh lệch', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Chênh lệch' || h === '' ? 'center' : 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { flow: 'Swift Đi',  color: '#2563eb', sc: 5029, sa: '24.7 tỷ', ct: 4826, ct1: 203, nc: 4928, na: '24.4 tỷ', diff: 101 },
                { flow: 'Swift Đến', color: '#7c3aed', sc: 3664, sa: '18.3 tỷ', ct: 3664, ct1: 0,   nc: 3630, na: '18.1 tỷ', diff:  34 },
              ].map((r, i) => (
                <tr key={r.flow} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 ? C.neutralBg : '#fff' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                      <span style={{ fontWeight: 600, color: C.text }}>{r.flow}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{r.sc.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: C.textMuted }}>{r.sa}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.ct.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: r.ct1 > 0 ? C.warning : C.textMuted }}>{r.ct1}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{r.nc.toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', color: C.textMuted }}>{r.na}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <Badge variant={r.diff === 0 ? 'success' : 'error'} dot>{r.diff > 0 ? `+${r.diff}` : r.diff === 0 ? 'Khớp' : r.diff}</Badge>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <Button size="sm" variant="ghost">Xem chi tiết</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Report templates ── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Mẫu báo cáo xuất file</div>
        {reports.length === 0
          ? <EmptyState icon="📊" title="Chưa có báo cáo nào" description="Tạo báo cáo đầu tiên từ kết quả đối soát." action="+ Tạo báo cáo" onAction={openCreate} />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map(r => <ReportCard key={r.id} r={r} onEdit={() => openEdit(r)} onDelete={() => deleteItem(r.id, r.name)} />)}
            </div>
        }
      </div>

      <ReportFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) {
            setReports(p => p.map(r => r.id === editing.id ? { ...r, ...data } : r))
            toast(`Đã cập nhật báo cáo "${data.name}".`, 'success')
          } else {
            setReports(p => [...p, { ...data, id: 'rpt_' + Date.now(), lastGenerated: null, status: 'idle' }])
            toast(`Đã tạo báo cáo "${data.name}".`, 'success')
          }
          setFormOpen(false)
        }}
      />
    </PageShell>
  )
}

function ReportCard({ r, onEdit, onDelete }) {
  const { toast } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    await new Promise(res => setTimeout(res, 1600))
    setExporting(false)
    toast(`Đã xuất "${r.name}" thành công.`, 'success')
  }

  const statusBadge = r.status === 'ready'
    ? <Badge variant="success" dot>Sẵn sàng</Badge>
    : <Badge variant="neutral">Chưa tạo</Badge>

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px' }}>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.name}</span>
            {statusBadge}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', gap: 16 }}>
            <span>Nguồn: <b style={{ color: C.primary }}>{r.sourceName}</b></span>
            <span>{r.format}</span>
            {r.lastGenerated && <span>Xuất lần cuối: {r.lastGenerated}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="sm" variant="primary"
            style={{ background: exporting ? '#34d399' : '#059669', borderColor: '#059669' }}
            disabled={exporting}
            onClick={handleExport}
          >
            {exporting
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Spinner />Đang xuất...</span>
              : 'Xuất Excel'
            }
          </Button>
          <Button size="sm" variant="ghost">Xem trước</Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>Sửa</Button>
          <Button size="sm" variant="ghost" onClick={onDelete} style={{ color: C.error }}>Xóa</Button>
        </div>
        <span style={{ color: C.textLight, fontSize: 16, cursor: 'pointer', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} onClick={() => setExpanded(e => !e)}>›</span>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${C.cardBorder}`, padding: '16px 20px', background: C.neutralBg }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Phần trong báo cáo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {r.sections.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 6, fontSize: 13 }}>
                <span style={{ color: C.primary, fontSize: 11, fontWeight: 700 }}>{i + 1}.</span>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const DEFAULT_FORM = { name: '', sourceLogic: 'jl_001', sourceName: 'Swift Đi vs Napas Đi', format: 'Excel (.xls)', sections: [] }

function ReportFormModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [newSection, setNewSection] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    setForm(editing ?? DEFAULT_FORM)
    setNewSection('')
  }, [editing, open])

  const addSection = () => {
    if (!newSection.trim()) return
    set('sections', [...form.sections, newSection.trim()])
    setNewSection('')
  }

  return (
    <Modal open={open} title={editing ? 'Sửa báo cáo' : 'Tạo báo cáo mới'} onClose={onClose} onConfirm={() => onSave(form)} width={560}>
      <FormRow label="Tên báo cáo">
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="VD: Bảng tổng hợp ĐI" />
      </FormRow>
      <FormRow label="Logic đối soát nguồn" hint="Báo cáo sẽ lấy dữ liệu từ kết quả của logic này">
        <Select value={form.sourceLogic} onChange={e => {
          const logic = LOGICS.find(l => l.id === e.target.value)
          set('sourceLogic', e.target.value)
          set('sourceName', logic?.name ?? '')
        }}>
          {LOGICS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
      </FormRow>
      <FormRow label="Định dạng xuất">
        <Select value={form.format} onChange={e => set('format', e.target.value)} disabled>
          <option>Excel (.xls)</option>
        </Select>
      </FormRow>
      <FormRow label="Các phần trong báo cáo" hint="Thêm từng nhóm dữ liệu sẽ xuất hiện trong báo cáo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {form.sections.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: C.neutralBg, borderRadius: 6, border: `1px solid ${C.cardBorder}`, fontSize: 13 }}>
              <span style={{ color: C.primary, fontSize: 12, minWidth: 20, fontWeight: 700 }}>{i + 1}.</span>
              <span style={{ flex: 1 }}>{s}</span>
              <button onClick={() => set('sections', form.sections.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={newSection} onChange={e => setNewSection(e.target.value)} placeholder="Tên phần mới..." onKeyDown={e => e.key === 'Enter' && addSection()} />
          <Button size="sm" variant="subtle" onClick={addSection}>Thêm</Button>
        </div>
      </FormRow>
    </Modal>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 11, height: 11,
      border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
