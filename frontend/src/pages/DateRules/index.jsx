import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Input, Select, FormRow } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'
import { RECON_STATUS_META } from '../../data/reconcile'

const CLASSIFICATION_OPTIONS = [
  { value: 'KHOP',           label: 'Khớp đủ – tự động khớp' },
  { value: 'KHOP_LECH_NGAY', label: 'Khớp lệch ngày – chấp nhận tự động' },
  { value: 'TIMEOUT_CO_CORE',label: 'Timeout – Core ghi nhận (cần review)' },
  { value: 'CHI_SWIFT',      label: 'Chỉ Swift – kiểm tra thủ công' },
  { value: 'SWIFT_TIMEOUT',  label: 'Swift timeout – xác nhận hủy' },
  { value: 'SWIFT_THAT_BAI', label: 'Swift thất bại – xác nhận hủy' },
  { value: 'NAPAS_THAT_BAI', label: 'NAPAS thất bại – liên hệ đối tác' },
  { value: 'CHI_NAPAS',      label: 'Chỉ NAPAS – kiểm tra thủ công' },
  { value: 'CHI_CORE',       label: 'Chỉ Core – kiểm tra thủ công' },
  { value: 'NGOAI_LE',       label: 'Ngoại lệ – cần điều tra' },
]

const CONDITION_OPTIONS = [
  { value: 'khop_du_3_nguon',       label: 'Khớp đủ 3 nguồn – trace, số tiền, ngày trùng nhau' },
  { value: 'lech_1_ngay',           label: 'Ngày lệch đúng 1 ngày (T±1)' },
  { value: 'lech_2_ngay',           label: 'Ngày lệch đúng 2 ngày (T±2)' },
  { value: 'swift_timeout_core_ok', label: 'Swift TIMEOUT nhưng Core + NAPAS ghi nhận' },
  { value: 'chi_swift_thanh_cong',  label: 'Swift THANH CONG – không có NAPAS / Core' },
  { value: 'swift_timeout_only',    label: 'Swift TIMEOUT – không có NAPAS / Core' },
  { value: 'swift_that_bai',        label: 'Swift THAT BAI – không có NAPAS / Core' },
  { value: 'napas_that_bai',        label: 'NAPAS báo thất bại (file lỗi đi)' },
  { value: 'chi_napas',             label: 'Chỉ có trên NAPAS – không có Swift / Core' },
  { value: 'chi_core',              label: 'Chỉ có trên Core – không có Swift / NAPAS' },
  { value: 'lech_qua_nguong',       label: 'Ngày lệch vượt ngưỡng (> 2 ngày)' },
]

const CONDITION_LABELS = Object.fromEntries(CONDITION_OPTIONS.map(o => [o.value, o.label]))

const INITIAL_DATE_RULES = [
  {
    id: 'dr_000', name: 'Khớp đủ 3 nguồn',
    description: 'Swift, NAPAS và Core đều có giao dịch với trace + số tiền + ngày trùng nhau. Đây là trường hợp lý tưởng – tự động đánh dấu khớp, không cần xử lý.',
    condition: 'khop_du_3_nguon', classification: 'KHOP', action: 'auto', active: true,
  },
  {
    id: 'dr_001', name: 'Lệch ngày T+1 (Core chốt sổ)',
    description: 'Swift và NAPAS khớp trace/amount cùng ngày T, Core hạch toán vào ngày T+1 do chốt sổ cuối ngày. Tự động chấp nhận là khớp lệch ngày.',
    condition: 'lech_1_ngay', classification: 'KHOP_LECH_NGAY', action: 'auto', active: true,
  },
  {
    id: 'dr_002', name: 'Lệch ngày T-1 (NAPAS quyết toán)',
    description: 'NAPAS ghi ngày quyết toán T-1 trong khi Swift và Core ghi ngày host T (cơ chế QT cuối ngày của NAPAS). Tự động chấp nhận là khớp lệch ngày.',
    condition: 'lech_1_ngay', classification: 'KHOP_LECH_NGAY', action: 'auto', active: true,
  },
  {
    id: 'dr_003', name: 'Lệch 2 ngày (qua cuối tuần / lễ)',
    description: 'Ngày lệch 2 ngày – thường xảy ra khi giao dịch thực hiện trước ngày nghỉ. Operator cần xác nhận thủ công trước khi chấp nhận.',
    condition: 'lech_2_ngay', classification: 'KHOP_LECH_NGAY', action: 'manual', active: true,
  },
  {
    id: 'dr_004', name: 'Swift Timeout – Core + NAPAS ghi nhận',
    description: 'Swift báo timeout nhưng Core và NAPAS đều ghi nhận giao dịch thành công. Giao dịch thực sự đã thực hiện – Operator cần review và xác nhận.',
    condition: 'swift_timeout_core_ok', classification: 'TIMEOUT_CO_CORE', action: 'manual', active: true,
  },
  {
    id: 'dr_005', name: 'Chỉ có Swift (THANH CONG)',
    description: 'Swift ghi nhận giao dịch THANH CONG nhưng không tìm thấy trace tương ứng bên NAPAS hoặc Core. Cần kiểm tra thủ công nguyên nhân.',
    condition: 'chi_swift_thanh_cong', classification: 'CHI_SWIFT', action: 'manual', active: true,
  },
  {
    id: 'dr_006', name: 'Swift Timeout – không có Core / NAPAS',
    description: 'Swift báo timeout và cả Core lẫn NAPAS đều không ghi nhận giao dịch này. Giao dịch khả năng đã bị hủy – Operator xác nhận hủy.',
    condition: 'swift_timeout_only', classification: 'SWIFT_TIMEOUT', action: 'manual', active: true,
  },
  {
    id: 'dr_007', name: 'Swift thất bại – trace không phát sinh bên NAPAS',
    description: 'Swift báo THAT_BAI và không có trace tương ứng trên NAPAS hoặc Core. Giao dịch không thực hiện được – Operator xác nhận hủy.',
    condition: 'swift_that_bai', classification: 'SWIFT_THAT_BAI', action: 'manual', active: true,
  },
  {
    id: 'dr_008', name: 'NAPAS thất bại (file lỗi đi)',
    description: 'Giao dịch xuất hiện trong file lỗi NAPAS chiều đi (NAPAS báo không thực hiện được). Cần liên hệ NAPAS để tra cứu và đối chiếu.',
    condition: 'napas_that_bai', classification: 'NAPAS_THAT_BAI', action: 'manual', active: true,
  },
  {
    id: 'dr_009', name: 'Chỉ có NAPAS',
    description: 'NAPAS ghi nhận giao dịch nhưng không tìm thấy trace tương ứng bên Swift hoặc Core. Cần kiểm tra thủ công – có thể thiếu dữ liệu đầu vào.',
    condition: 'chi_napas', classification: 'CHI_NAPAS', action: 'manual', active: true,
  },
  {
    id: 'dr_010', name: 'Chỉ có Core',
    description: 'Core ghi nhận giao dịch nhưng không tìm thấy trace tương ứng bên Swift hoặc NAPAS. Cần kiểm tra thủ công – có thể là giao dịch nội bộ.',
    condition: 'chi_core', classification: 'CHI_CORE', action: 'manual', active: true,
  },
  {
    id: 'dr_011', name: 'Lệch ngày quá ngưỡng – ngoại lệ',
    description: 'Chênh lệch ngày vượt quá 2 ngày và không khớp bất kỳ quy tắc nào. Không thể tự động phân loại – đánh dấu ngoại lệ để điều tra.',
    condition: 'lech_qua_nguong', classification: 'NGOAI_LE', action: 'manual', active: true,
  },
]

export default function DateRules() {
  const { showConfirm, toast } = useApp()
  const { user } = useAuth()
  const isAdmin    = user?.role === 'Admin'
  const isOperator = user?.role === 'Operator'

  const [rules, setRules]       = useState(INITIAL_DATE_RULES)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState(null)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit   = (rule) => { setEditing(rule); setFormOpen(true) }

  const toggleActive = (rule) => {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))
    toast(`Quy tắc "${rule.name}" đã ${rule.active ? 'tắt' : 'bật'}.`, 'success')
  }

  const deleteRule = (rule) => showConfirm({
    title: `Xóa quy tắc "${rule.name}"?`,
    message: 'Giao dịch đã phân loại sẽ không bị ảnh hưởng. Giao dịch mới sẽ không áp dụng quy tắc này nữa.',
    variant: 'danger', confirmLabel: 'Xóa',
    onConfirm: () => {
      setRules(prev => prev.filter(r => r.id !== rule.id))
      toast(`Đã xóa quy tắc "${rule.name}".`, 'success')
    },
  })

  return (
    <PageShell
      title="Phân loại trạng thái đối soát"
      subtitle="Định nghĩa các trường hợp trạng thái kết quả đối soát — mỗi quy tắc xác định điều kiện và cách xử lý tương ứng."
      actions={isAdmin ? <Button size="sm" onClick={openCreate}>+ Thêm quy tắc</Button> : null}
    >
      <div style={{ padding: '12px 16px', marginBottom: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: radius.md, fontSize: 13, color: '#1e40af' }}>
        Mỗi quy tắc mô tả 1 trạng thái kết quả đối soát — điều kiện phát sinh và cách xử lý. Đây là nguồn tham chiếu cho các trạng thái hiển thị trong bảng đối soát.
        {isOperator && <span style={{ marginLeft: 8, color: '#3b82f6' }}>Operator chỉ xem – Admin có thể chỉnh sửa.</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rules.map((rule) => {
          const sm = RECON_STATUS_META[rule.classification]
          return (
            <div key={rule.id} style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden', opacity: rule.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px' }}>
                {isAdmin && (
                  <button onClick={() => toggleActive(rule)} title={rule.active ? 'Bật – nhấn để tắt' : 'Tắt – nhấn để bật'}
                    style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: rule.active ? C.success : C.cardBorder, position: 'relative', transition: 'background 0.15s' }}>
                    <span style={{ position: 'absolute', top: 3, left: rule.active ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                  </button>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{rule.name}</span>
                    {sm && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>}
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: rule.action === 'auto' ? '#f0fdf4' : C.neutralBg, color: rule.action === 'auto' ? '#059669' : C.textMuted, border: `1px solid ${rule.action === 'auto' ? '#bbf7d0' : C.cardBorder}` }}>
                      {rule.action === 'auto' ? 'Tự động' : 'Thủ công'}
                    </span>
                    {!rule.active && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: C.neutralBg, color: C.textMuted, border: `1px solid ${C.cardBorder}` }}>Đã tắt</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 3 }}>
                    <b>Điều kiện:</b> {CONDITION_LABELS[rule.condition] ?? rule.condition}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{rule.description}</div>
                </div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rule)}>Sửa</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteRule(rule)} style={{ color: C.error }}>Xóa</Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {rules.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          Chưa có quy tắc nào.{isAdmin && ' Nhấn "+ Thêm quy tắc" để tạo.'}
        </div>
      )}

      {isAdmin && (
        <DateRuleFormModal
          open={formOpen} editing={editing}
          onClose={() => setFormOpen(false)}
          onSave={(data) => {
            if (editing) {
              setRules(prev => prev.map(r => r.id === editing.id ? { ...r, ...data } : r))
              toast('Đã lưu quy tắc.', 'success')
            } else {
              setRules(prev => [...prev, { ...data, id: 'dr_' + Date.now() }])
              toast('Đã thêm quy tắc mới.', 'success')
            }
            setFormOpen(false)
          }}
        />
      )}
    </PageShell>
  )
}

function DateRuleFormModal({ open, editing, onClose, onSave }) {
  const blank = { name: '', description: '', condition: 'khop_du_3_nguon', classification: 'KHOP', action: 'auto', active: true }
  const [form, setForm] = useState(() => editing ?? blank)
  useState(() => { if (open) setForm(editing ?? blank) })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open={open} title={editing ? 'Sửa quy tắc' : 'Thêm quy tắc phân loại'} onClose={onClose} onConfirm={() => onSave(form)} width={580}>
      <FormRow label="Tên quy tắc">
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="VD: Lệch ngày T+1 (Core)" />
      </FormRow>
      <FormRow label="Mô tả">
        <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Mô tả điều kiện và cách xử lý..." />
      </FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormRow label="Điều kiện">
          <Select value={form.condition} onChange={e => set('condition', e.target.value)}>
            {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FormRow>
        <FormRow label="Phân loại kết quả">
          <Select value={form.classification} onChange={e => set('classification', e.target.value)}>
            {CLASSIFICATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FormRow>
        <FormRow label="Cách xử lý">
          <Select value={form.action} onChange={e => set('action', e.target.value)}>
            <option value="auto">Tự động – không cần xác nhận</option>
            <option value="manual">Thủ công – Operator xác nhận</option>
          </Select>
        </FormRow>
        <FormRow label="Trạng thái">
          <Select value={String(form.active)} onChange={e => set('active', e.target.value === 'true')}>
            <option value="true">Đang bật</option>
            <option value="false">Đã tắt</option>
          </Select>
        </FormRow>
      </div>
    </Modal>
  )
}
