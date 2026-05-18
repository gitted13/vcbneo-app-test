import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { Input, Select, FormRow } from '../../components/Input'
import { C, radius, shadow } from '../../theme'

/* ── Mock data ──────────────────────────────────────────────────────────────── */
const KPI = [
  { label: 'Tổng GD Swift Đi',  val: '8,381',  sub: 'hôm nay',  delta: '+2.3%', up: true,  color: '#2563eb', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '#bfdbfe', icon: '→' },
  { label: 'Tổng GD Swift Đến', val: '6,104',  sub: 'hôm nay',  delta: '+1.1%', up: true,  color: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '#c4b5fd', icon: '←' },
  { label: 'Khớp NAPAS Đi',     val: '2,664',  sub: '/ 2,722',  delta: '97.9%', up: true,  color: '#059669', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#bbf7d0', icon: '✓' },
  { label: 'Lệch / Chưa khớp',  val: '58',     sub: 'cần xử lý', delta: '−14',  up: false, color: '#dc2626', bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fecaca', icon: '!' },
]

const DAILY_SWIFT = [
  { date: '01/02', di: 8200, den: 5900 },
  { date: '02/02', di: 8050, den: 6200 },
  { date: '03/02', di: 7800, den: 5800 },
  { date: '04/02', di: 8150, den: 6050 },
  { date: '05/02', di: 8381, den: 6104 },
]

const STATUS_BREAKDOWN = [
  { label: 'Thành công',  count: 2664, pct: 97.9, color: '#059669', bg: '#dcfce7' },
  { label: 'Timeout',     count: 24,   pct: 0.9,  color: '#d97706', bg: '#fef3c7' },
  { label: 'Thất bại',    count: 10,   pct: 0.4,  color: '#dc2626', bg: '#fee2e2' },
  { label: 'Chỉ Napas',   count: 34,   pct: 1.2,  color: '#7c3aed', bg: '#ede9fe' },
]

const INITIAL_REPORTS = [
  {
    id: 'rpt_001',
    name: 'Bảng tổng hợp ĐI – Đối chiếu Napas',
    sourceLogic: 'jl_001', sourceName: 'Swift Đi vs Napas Đi',
    lastGenerated: '2026-02-05 09:05', format: 'Excel (.xls)',
    sections: ['Tiêu đề ngân hàng', 'Swift count/amount', 'Core ngày T', 'Core ngày T+1', 'GL ngày T', 'Napas ngày T'],
    status: 'ready',
  },
  {
    id: 'rpt_002',
    name: 'Bảng tổng hợp ĐẾN – Đối chiếu Napas',
    sourceLogic: 'jl_002', sourceName: 'Swift Đến vs Napas Đến',
    lastGenerated: '2026-02-05 09:06', format: 'Excel (.xls)',
    sections: ['Tiêu đề ngân hàng', 'Swift count/amount', 'Core ngày T', 'GL ngày T', 'Napas ngày T', 'Giao dịch Timeout'],
    status: 'ready',
  },
  {
    id: 'rpt_003',
    name: 'Danh sách ĐI lỗi – Hoàn trả',
    sourceLogic: 'jl_001', sourceName: 'Swift Đi vs Napas Đi',
    lastGenerated: null, format: 'Excel (.xls)',
    sections: ['Ngày phát sinh', 'Trace', 'Tài khoản', 'Số tiền', 'Trạng thái Swift', 'Kết quả Napas'],
    status: 'idle',
  },
]

const LOGICS = [
  { id: 'jl_001', name: 'Swift Đi vs Napas Đi' },
  { id: 'jl_002', name: 'Swift Đến vs Napas Đến' },
  { id: 'jl_003', name: 'Swift Đi vs Core (Ghi có)' },
]

/* ── helpers ────────────────────────────────────────────────────────────────── */
const maxBar = Math.max(...DAILY_SWIFT.map(d => Math.max(d.di, d.den)))

export default function Reports() {
  const [reports, setReports] = useState(INITIAL_REPORTS)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [activeDate, setActiveDate] = useState('05/02')

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit   = (r)  => { setEditing(r);  setFormOpen(true) }
  const deleteItem = (id) => setReports(p => p.filter(r => r.id !== id))

  return (
    <PageShell
      title="Báo cáo"
      subtitle="Tổng quan kết quả đối soát ngày 05/02/2026 · Ngân hàng TM TNHH MTV Xây dựng Việt Nam"
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

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Bar chart – daily volume */}
        <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Lượng giao dịch 5 ngày gần nhất</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Swift Đi vs Swift Đến</div>
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
                      height: `${(d.di / maxBar) * 110}px`,
                      transition: 'height 0.3s',
                      cursor: 'pointer',
                    }} onClick={() => setActiveDate(d.date)} title={`Swift Đi: ${d.di.toLocaleString()}`} />
                    <div style={{
                      width: 18, borderRadius: '3px 3px 0 0', background: d.date === activeDate ? '#7c3aed' : '#c4b5fd',
                      height: `${(d.den / maxBar) * 110}px`,
                      transition: 'height 0.3s',
                      cursor: 'pointer',
                    }} onClick={() => setActiveDate(d.date)} title={`Swift Đến: ${d.den.toLocaleString()}`} />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: d.date === activeDate ? C.primary : C.textMuted, fontWeight: d.date === activeDate ? 700 : 400 }}>{d.date}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: '10px 14px', background: C.neutralBg, borderRadius: radius.md, fontSize: 12 }}>
            {DAILY_SWIFT.find(d => d.date === activeDate) && (() => {
              const d = DAILY_SWIFT.find(x => x.date === activeDate)
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

        {/* Donut-style status breakdown */}
        <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Trạng thái đối soát Đi</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>Swift Đi vs Napas Đi · 2,732 GD</div>

          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', marginBottom: 16 }}>
            {STATUS_BREAKDOWN.map(s => (
              <div key={s.label} style={{ width: `${s.pct}%`, background: s.color, transition: 'width 0.4s', minWidth: s.pct > 0.5 ? 4 : 0 }} title={`${s.label}: ${s.pct}%`} />
            ))}
          </div>

          {/* Legend rows */}
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
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Tổng hợp đối soát – 05/02/2026</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>So sánh giữa Swift, Core và NAPAS</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Luồng', 'Swift count', 'Swift amount', 'Core GD T', 'Core GD T+1', 'Napas count', 'Napas amount', 'Chênh lệch', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Chênh lệch' || h === '' ? 'center' : 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { flow: 'Swift Đi',  color: '#2563eb', sc: 8381, sa: '42.1 tỷ', ct: 8200, ct1: 181, nc: 8347, na: '41.9 tỷ', diff: 34, ok: false },
                { flow: 'Swift Đến', color: '#7c3aed', sc: 6104, sa: '28.6 tỷ', ct: 6104, ct1: 0,   nc: 6073, na: '28.5 tỷ', diff: 31, ok: false },
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
              {reports.map(r => <ReportCard key={r.id} r={r} onEdit={() => openEdit(r)} onDelete={() => deleteItem(r.id)} />)}
            </div>
        }
      </div>

      <ReportFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) setReports(p => p.map(r => r.id === editing.id ? { ...r, ...data } : r))
          else setReports(p => [...p, { ...data, id: 'rpt_' + Date.now(), lastGenerated: null, status: 'idle' }])
          setFormOpen(false)
        }}
      />
    </PageShell>
  )
}

function ReportCard({ r, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
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
          <Button size="sm" variant="primary" style={{ background: '#059669', borderColor: '#059669' }}>Xuất Excel</Button>
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

function ReportFormModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(editing ?? {
    name: '', sourceLogic: 'jl_001', sourceName: 'Swift Đi vs Napas Đi',
    format: 'Excel (.xls)', sections: [],
  })
  const [newSection, setNewSection] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

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
              <button onClick={() => set('sections', form.sections.filter((_,j) => j!==i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 16 }}>×</button>
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
