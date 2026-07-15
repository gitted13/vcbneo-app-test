import { useState, useEffect, useCallback } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { Input, Select, FormRow } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'
import {
  FIELD_OPTIONS, STATUS_FIELDS, DATE_FIELDS, PRESENCE_FIELDS,
  STATUS_VALUE_OPTIONS, DATE_FIELD_DEFAULT_COMPARE,
  fieldKind, fieldLabel, describeChip, describeGroup,
} from '../../data/dateRulesVocab'

const F = (f, op, v) => ({ f, op, v })
const rule = (id, label, color, ...groups) => ({ id, label, color, groups })

/* Mirrors backend/app/db/seed.py's _STATUS_RULES exactly — this is what
 * "Khôi phục mặc định" restores. Keep both in sync if the defaults change. */
const DEFAULT_CONDS = {
  SWIFT_DI: [
    rule('swift_di_0', 'Thành công – Core ngày T', '#059669',
      [F('Ngày GD', '=', 'Ngày GN'), F('TT Swift', '=', 'Thành công'), F('Core', 'ne', 'null')]),
    rule('swift_di_1', 'Thành công – Core ngày T+1', '#0891b2',
      [F('Ngày GD', 'ne', 'Ngày GN'), F('TT Swift', '=', 'Thành công'), F('Core', 'ne', 'null')]),
    rule('swift_di_2', 'Timeout – Core ngày T', '#d97706',
      [F('Ngày GD', '=', 'Ngày GN'), F('TT Swift', '=', 'Timeout'), F('Core', 'ne', 'null')]),
    rule('swift_di_3', 'Timeout – Core ngày T+1', '#f59e0b',
      [F('Ngày GD', 'ne', 'Ngày GN'), F('TT Swift', '=', 'Timeout'), F('Core', 'ne', 'null')]),
    rule('swift_di_4', 'Thất bại – ngày T', '#6b7280',
      [F('Ngày GD', '=', 'Ngày GN'), F('TT Swift', '=', 'Thất bại'), F('Core', 'ne', 'null')]),
    rule('swift_di_5', 'Thất bại – ngày T+1', '#9ca3af',
      [F('Ngày GD', 'ne', 'Ngày GN'), F('TT Swift', '=', 'Thất bại'), F('Core', 'ne', 'null')]),
    rule('swift_di_6', 'Chỉ Swift', '#dc2626', [F('Core', '=', 'null')]),
  ],
  SWIFT_DEN: [
    rule('swift_den_0', 'Thành công – Core ngày T', '#059669',
      [F('Ngày GD', '=', 'Ngày GN'), F('TT Swift', '=', 'Thành công'), F('Core', 'ne', 'null')]),
    rule('swift_den_1', 'Thành công – Core ngày T+1', '#0891b2',
      [F('Ngày GD', 'ne', 'Ngày GN'), F('TT Swift', '=', 'Thành công'), F('Core', 'ne', 'null')]),
    rule('swift_den_2', 'Timeout – Core ngày T', '#d97706',
      [F('Ngày GD', '=', 'Ngày GN'), F('TT Swift', '=', 'Timeout'), F('Core', 'ne', 'null')]),
    rule('swift_den_3', 'Timeout – Core ngày T+1', '#f59e0b',
      [F('Ngày GD', 'ne', 'Ngày GN'), F('TT Swift', '=', 'Timeout'), F('Core', 'ne', 'null')]),
    rule('swift_den_4', 'Thất bại – ngày T', '#6b7280',
      [F('Ngày GD', '=', 'Ngày GN'), F('TT Swift', '=', 'Thất bại'), F('Core', 'ne', 'null')]),
    rule('swift_den_5', 'Thất bại – ngày T+1', '#9ca3af',
      [F('Ngày GD', 'ne', 'Ngày GN'), F('TT Swift', '=', 'Thất bại'), F('Core', 'ne', 'null')]),
    rule('swift_den_6', 'Chỉ Swift', '#dc2626', [F('Core', '=', 'null')]),
  ],
  NAPAS_DI: [
    rule('napas_di_0', 'Thành công – NAPAS ngày T-1, Core ngày T', '#0891b2',
      [F('Ngày NAPAS', '<', 'Ngày Core'), F('TC/KTC', '=', 'TC'), F('Core', 'ne', 'null')]),
    rule('napas_di_1', 'Thành công – NAPAS ngày T, Core ngày T', '#059669',
      [F('Ngày NAPAS', '=', 'Ngày Core'), F('TC/KTC', '=', 'TC'), F('Core', 'ne', 'null')]),
    rule('napas_di_2', 'Không thành công (KTC)', '#dc2626', [F('TC/KTC', '=', 'KTC')]),
    rule('napas_di_3', 'Chỉ NAPAS TC – không có Core', '#d97706',
      [F('TC/KTC', '=', 'TC'), F('Core', '=', 'null')]),
  ],
  NAPAS_DEN: [
    rule('napas_den_0', 'Thành công – Core ngày T-1', '#7c3aed',
      [F('Ngày Core', '<', 'Ngày NAPAS'), F('Core', 'ne', 'null')]),
    rule('napas_den_1', 'Thành công – Core ngày T', '#059669',
      [F('Ngày Core', '=', 'Ngày NAPAS'), F('Core', 'ne', 'null')]),
    rule('napas_den_2', 'Thành công – Core ngày T+1', '#0891b2',
      [F('Ngày Core', '>', 'Ngày NAPAS'), F('Core', 'ne', 'null')]),
  ],
  CORE_DI: [
    rule('core_di_0', 'Swift ngày T-1 – NAPAS ngày T', '#0891b2',
      [F('Ngày NAPAS', '<', 'Ngày Core'), F('Core', 'ne', 'null')]),
    rule('core_di_1', 'Swift ngày T – NAPAS ngày T', '#059669',
      [F('Ngày NAPAS', '=', 'Ngày Core'), F('Core', 'ne', 'null')]),
    rule('core_di_2', 'Swift ngày T – NAPAS ngày T+1', '#7c3aed',
      [F('Ngày NAPAS', '>', 'Ngày Core'), F('Core', 'ne', 'null')]),
    rule('core_di_3', 'Thất bại – không có trên NAPAS', '#d97706',
      [F('TT Swift', '=', 'Thất bại'), F('Core', 'ne', 'null')]),
  ],
  CORE_DEN: [
    rule('core_den_0', 'Core ngày T – NAPAS ngày T-1', '#0891b2',
      [F('Ngày NAPAS', '<', 'Ngày Core'), F('Core', 'ne', 'null')]),
    rule('core_den_1', 'Core ngày T – NAPAS ngày T', '#059669',
      [F('Ngày NAPAS', '=', 'Ngày Core'), F('Core', 'ne', 'null')]),
    rule('core_den_2', 'Core ngày T – NAPAS ngày T+1', '#7c3aed',
      [F('Ngày NAPAS', '>', 'Ngày Core'), F('Core', 'ne', 'null')]),
    rule('core_den_3', 'Core có – không có NAPAS', '#d97706', [F('Core', '=', 'null')]),
  ],
}

const COLOR_PRESETS = ['#059669', '#0891b2', '#7c3aed', '#d97706', '#dc2626', '#6b7280', '#f59e0b', '#9ca3af', '#2563eb', '#be185d']

function newBlankRule() {
  return { id: `r_${Date.now()}`, label: '', color: COLOR_PRESETS[0], groups: [[F(FIELD_OPTIONS[0], '=', '')]] }
}

function newBlankChip(field = FIELD_OPTIONS[0]) {
  const kind = fieldKind(field)
  if (kind === 'presence') return F(field, 'ne', 'null')
  if (kind === 'date') return F(field, '=', DATE_FIELD_DEFAULT_COMPARE[field] || DATE_FIELDS[0])
  return F(field, '=', STATUS_VALUE_OPTIONS[field]?.[0]?.value || '')
}

/* ── Chip editor row — one condition, adapts inputs to field kind ────────── */
function ChipRow({ chip, onChange, onRemove }) {
  const kind = fieldKind(chip.f)
  const sel = { fontSize: 12, padding: '4px 8px', borderRadius: 5, border: `1px solid ${C.cardBorder}`, background: '#fff', fontFamily: 'inherit' }

  const setField = (f) => onChange(newBlankChip(f))

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 8px', background: '#fff', borderRadius: 6, border: `1px solid ${C.cardBorder}` }}>
      <select value={chip.f} onChange={e => setField(e.target.value)} style={{ ...sel, minWidth: 180 }}>
        {FIELD_OPTIONS.map(f => <option key={f} value={f}>{fieldLabel(f)}</option>)}
      </select>

      {kind === 'presence' && (
        <select value={chip.op === '=' ? 'no' : 'yes'} onChange={e => onChange({ ...chip, op: e.target.value === 'yes' ? 'ne' : '=', v: 'null' })} style={{ ...sel, minWidth: 160 }}>
          <option value="yes">Có tương ứng</option>
          <option value="no">Không có tương ứng</option>
        </select>
      )}

      {kind === 'date' && (
        <>
          <select value={chip.op} onChange={e => onChange({ ...chip, op: e.target.value })} style={{ ...sel, width: 90 }}>
            <option value="=">bằng</option>
            <option value="ne">khác</option>
            <option value="<">trước</option>
            <option value=">">sau</option>
          </select>
          <select value={chip.v} onChange={e => onChange({ ...chip, v: e.target.value })} style={{ ...sel, minWidth: 180 }}>
            {DATE_FIELDS.filter(f => f !== chip.f).map(f => <option key={f} value={f}>{fieldLabel(f)}</option>)}
          </select>
        </>
      )}

      {kind === 'status' && (
        <>
          <select value={chip.op} onChange={e => onChange({ ...chip, op: e.target.value })} style={{ ...sel, width: 80 }}>
            <option value="=">là</option>
            <option value="ne">khác</option>
          </select>
          {STATUS_VALUE_OPTIONS[chip.f] ? (
            <select value={chip.v} onChange={e => onChange({ ...chip, v: e.target.value })} style={{ ...sel, minWidth: 160 }}>
              {STATUS_VALUE_OPTIONS[chip.f].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input value={chip.v} onChange={e => onChange({ ...chip, v: e.target.value })} placeholder="giá trị..." style={{ ...sel, width: 140 }} />
          )}
        </>
      )}

      <button onClick={onRemove} title="Xóa điều kiện này" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
    </div>
  )
}

/* ── Group editor — one AND-group of chips ────────────────────────────────── */
function GroupEditor({ group, onChange, onRemoveGroup, showRemoveGroup }) {
  const setChip = (i, chip) => onChange(group.map((c, j) => j === i ? chip : c))
  const removeChip = (i) => onChange(group.filter((_, j) => j !== i))
  const addChip = () => onChange([...group, newBlankChip()])

  return (
    <div style={{ padding: 10, background: '#f8fafc', borderRadius: radius.md, border: `1px dashed ${C.cardBorder}` }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {group.map((chip, i) => (
          <div key={i}>
            {i > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, margin: '4px 0 4px 4px' }}>VÀ</div>}
            <ChipRow chip={chip} onChange={c => setChip(i, c)} onRemove={() => removeChip(i)} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={addChip} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: `1px dashed ${C.primary}`, background: 'none', color: C.primary, cursor: 'pointer' }}>+ Thêm điều kiện (VÀ)</button>
        {showRemoveGroup && (
          <button onClick={onRemoveGroup} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: 'none', background: 'none', color: C.error, cursor: 'pointer' }}>Xóa nhóm này</button>
        )}
      </div>
    </div>
  )
}

/* ── Rule editor modal — create or edit one status ────────────────────────── */
function RuleModal({ open, editing, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => editing ?? newBlankRule())
  useEffect(() => { if (open) setForm(editing ? JSON.parse(JSON.stringify(editing)) : newBlankRule()) }, [open, editing])

  const setGroup = (i, group) => setForm(f => ({ ...f, groups: f.groups.map((g, j) => j === i ? group : g) }))
  const removeGroup = (i) => setForm(f => ({ ...f, groups: f.groups.filter((_, j) => j !== i) }))
  const addGroup = () => setForm(f => ({ ...f, groups: [...f.groups, [newBlankChip()]] }))

  const canSave = form.label.trim() && form.groups.length > 0 && form.groups.every(g => g.length > 0)

  return (
    <Modal
      open={open}
      title={editing ? 'Sửa trạng thái' : 'Tạo trạng thái mới'}
      onClose={onClose}
      onConfirm={() => canSave && onSave({ ...form, label: form.label.trim() })}
      confirmLabel="Lưu"
      width={640}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 4 }}>
        <FormRow label="Tên trạng thái" hint="Hiển thị cho người dùng khi xem kết quả đối soát">
          <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="VD: Thành công – khớp cùng ngày" />
        </FormRow>
        <FormRow label="Màu">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 130 }}>
            {COLOR_PRESETS.map(c => (
              <button
                key={c}
                onClick={() => setForm(f => ({ ...f, color: c }))}
                title={c}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: form.color === c ? `2px solid ${C.text}` : '2px solid transparent',
                  boxShadow: form.color === c ? `0 0 0 1px #fff inset` : 'none',
                }}
              />
            ))}
          </div>
        </FormRow>
      </div>

      <FormRow label="Điều kiện" hint="Trạng thái này được gán khi TẤT CẢ điều kiện trong ít nhất 1 nhóm đều đúng (các nhóm nối bằng HOẶC)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {form.groups.map((group, i) => (
            <div key={i}>
              {i > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                  <div style={{ flex: 1, height: 1, background: C.cardBorder }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>HOẶC</span>
                  <div style={{ flex: 1, height: 1, background: C.cardBorder }} />
                </div>
              )}
              <GroupEditor
                group={group}
                onChange={g => setGroup(i, g)}
                onRemoveGroup={() => removeGroup(i)}
                showRemoveGroup={form.groups.length > 1}
              />
            </div>
          ))}
        </div>
        <button onClick={addGroup} style={{ marginTop: 8, fontSize: 12, padding: '5px 12px', borderRadius: 6, border: `1px dashed ${C.primary}`, background: 'none', color: C.primary, cursor: 'pointer' }}>+ Thêm nhóm điều kiện (HOẶC)</button>
      </FormRow>

      {editing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.cardBorder}` }}>
          <button
            onClick={() => onDelete(editing)}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.errorBorder ?? '#fecaca'}`, background: 'none', color: C.error, cursor: 'pointer' }}
          >
            Xóa trạng thái này
          </button>
        </div>
      )}
    </Modal>
  )
}

/* ── Rule row (read view) ──────────────────────────────────────────────────── */
function RuleRow({ r, onEdit }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
      <td style={{ padding: '10px 14px', verticalAlign: 'top', width: '30%' }}>
        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 5, fontSize: 12, fontWeight: 700, background: `${r.color}1a`, color: r.color, border: `1px solid ${r.color}4d` }}>
          {r.label}
        </span>
      </td>
      <td style={{ padding: '10px 14px', verticalAlign: 'top', fontSize: 12, color: C.text, lineHeight: 1.7 }}>
        {r.groups.map((g, i) => (
          <div key={i}>
            {i > 0 && <span style={{ color: C.primary, fontWeight: 700 }}>HOẶC </span>}
            {describeGroup(g)}
          </div>
        ))}
        {r.groups.length === 0 && <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>Chưa có điều kiện</span>}
      </td>
      <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', width: 52 }}>
        <button
          onClick={onEdit}
          title="Chỉnh sửa"
          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', padding: '4px 7px', fontSize: 13, color: '#9ca3af', lineHeight: 1 }}
          onMouseEnter={e => Object.assign(e.currentTarget.style, { background: '#f3f4f6', color: '#374151' })}
          onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'none', color: '#9ca3af' })}
        >✎</button>
      </td>
    </tr>
  )
}

/* ── Table for one tab (one cond_key) ─────────────────────────────────────── */
function RuleTable({ rules, onEdit, onCreate }) {
  const th = { padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.cardBorder}` }
  return (
    <div style={{ border: `1px solid ${C.cardBorder}`, borderRadius: radius.md, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.neutralBg }}>
            <th style={th}>Trạng thái</th>
            <th style={th}>Điều kiện dữ liệu</th>
            <th style={{ ...th, width: 52 }}></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r, i) => <RuleRow key={r.id ?? i} r={r} onEdit={() => onEdit(r)} />)}
        </tbody>
      </table>
      <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.cardBorder}`, background: '#fafafa' }}>
        <button onClick={onCreate} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: `1px dashed ${C.primary}`, background: 'none', color: C.primary, cursor: 'pointer' }}>+ Tạo trạng thái mới</button>
      </div>
    </div>
  )
}

/* ── Section config — UI chrome only, no status data (that comes from conds) ─ */
const SECTIONS = [
  {
    id: 'swift', title: 'Swift ↔ Core GL', accent: '#1e40af', accentBg: '#eff6ff', accentBorder: '#bfdbfe',
    note: 'T = txnDate (ngày GD thực tế của Swift). T+1 khi txnDate ≠ hostDate — Core ghi nhận vào ngày tiếp theo.',
    tabs: [
      { label: 'Chiều Đi',  condKey: 'SWIFT_DI' },
      { label: 'Chiều Đến', condKey: 'SWIFT_DEN' },
    ],
  },
  {
    id: 'napas', title: 'NAPAS ↔ Core GL', accent: '#854d0e', accentBg: '#fefce8', accentBorder: '#fde68a',
    note: 'NAPAS không có timeout — chỉ TC (failed = false) và KTC (failed = true). T = napas.date.',
    tabs: [
      { label: 'Chiều Đi',  condKey: 'NAPAS_DI' },
      { label: 'Chiều Đến', condKey: 'NAPAS_DEN' },
    ],
  },
  {
    id: 'core', title: 'Core GL ↔ Swift + NAPAS', accent: '#166534', accentBg: '#dcfce7', accentBorder: '#86efac',
    note: 'Core làm gốc (T = core.date). Swift và NAPAS so sánh ngày tương đối với core.date.',
    tabs: [
      { label: 'Ghi có (Đi)',  condKey: 'CORE_DI' },
      { label: 'Ghi nợ (Đến)', condKey: 'CORE_DEN' },
    ],
  },
]

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function DateRules() {
  const { toast } = useApp()
  const [activeTabs, setActiveTabs] = useState({ swift: 0, napas: 0, core: 0 })
  const [conds, setConds]           = useState(DEFAULT_CONDS)
  const [saving, setSaving]         = useState(false)
  const [dbLoaded, setDbLoaded]     = useState(false)
  const [modal, setModal]           = useState(null) // { condKey, editing: rule|null }

  useEffect(() => {
    api.reconcileConfig.getStatusRules()
      .then(res => {
        if (res.rules && Object.keys(res.rules).length > 0) setConds(res.rules)
        setDbLoaded(true)
      })
      .catch(() => setDbLoaded(true))
  }, [])

  const setTab = (sectionId, idx) => setActiveTabs(p => ({ ...p, [sectionId]: idx }))

  const persist = useCallback((next, successMsg) => {
    setConds(next)
    setSaving(true)
    api.reconcileConfig.saveStatusRules(next)
      .then(() => { if (successMsg) toast(successMsg, 'success') })
      .catch(() => toast('Lưu thất bại.', 'error'))
      .finally(() => setSaving(false))
  }, [toast])

  const handleReset = () => persist(DEFAULT_CONDS, 'Đã khôi phục mặc định.')

  const handleSaveRule = (condKey, ruleData) => {
    const list = conds[condKey] || []
    const idx = list.findIndex(r => r.id === ruleData.id)
    const nextList = idx >= 0 ? list.map((r, i) => i === idx ? ruleData : r) : [...list, ruleData]
    persist({ ...conds, [condKey]: nextList }, idx >= 0 ? 'Đã lưu thay đổi.' : 'Đã tạo trạng thái mới.')
    setModal(null)
  }

  const handleDeleteRule = (condKey, ruleData) => {
    if (!window.confirm(`Xóa trạng thái "${ruleData.label}"? Không thể hoàn tác.`)) return
    const nextList = (conds[condKey] || []).filter(r => r.id !== ruleData.id)
    persist({ ...conds, [condKey]: nextList }, 'Đã xóa trạng thái.')
    setModal(null)
  }

  const modified = JSON.stringify(conds) !== JSON.stringify(DEFAULT_CONDS)

  return (
    <PageShell
      title="Phân loại trạng thái đối soát"
      subtitle="Định nghĩa điều kiện dữ liệu tạo ra từng trạng thái. Nhấn ✎ để sửa, hoặc tạo trạng thái mới — tự động lưu vào DB."
    >
      {/* Info bar */}
      <div style={{
        padding: '10px 14px', marginBottom: modified ? 10 : 20,
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: radius.md,
        fontSize: 13, color: '#1e40af', display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ</span>
        <span style={{ flex: 1 }}>
          Bấm <b>✎</b> để sửa một trạng thái, hoặc <b>+ Tạo trạng thái mới</b> để thêm.
          {saving ? ' Đang lưu...' : ' Thay đổi tự động lưu vào DB.'}
        </span>
        {modified && (
          <button onClick={handleReset} style={{
            flexShrink: 0, fontSize: 11, padding: '4px 12px', borderRadius: 5,
            border: '1px solid #fecaca', background: '#fef2f2',
            color: '#dc2626', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>↺ Khôi phục mặc định</button>
        )}
      </div>

      {modified && (
        <div style={{
          marginBottom: 20, padding: '8px 14px',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: radius.md,
          fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontWeight: 700 }}>⚠</span>
          Cấu hình đang khác mặc định — đã lưu vào DB, ảnh hưởng đến kết quả phân loại đối soát.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {SECTIONS.map(sec => {
          const activeIdx = activeTabs[sec.id]
          const tab = sec.tabs[activeIdx]
          const rules = conds[tab.condKey] || []
          return (
            <div key={sec.id} style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, background: sec.accentBg, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: sec.accent }}>{sec.title}</span>
                <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{sec.note}</span>
              </div>

              <div style={{ display: 'flex', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
                {sec.tabs.map((t, i) => {
                  const active = i === activeIdx
                  const count = (conds[t.condKey] || []).length
                  return (
                    <button key={i} onClick={() => setTab(sec.id, i)} style={{
                      padding: '8px 18px', border: 'none',
                      borderBottom: active ? `2px solid ${sec.accent}` : '2px solid transparent',
                      background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                      fontWeight: active ? 700 : 400, color: active ? sec.accent : C.textMuted,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {t.label}
                      <span style={{
                        fontSize: 11, padding: '1px 6px', borderRadius: 10,
                        background: active ? sec.accentBg : C.cardBorder,
                        color: active ? sec.accent : C.textMuted,
                        border: `1px solid ${active ? sec.accentBorder : C.cardBorder}`,
                      }}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div style={{ padding: 16 }}>
                <RuleTable
                  rules={rules}
                  onEdit={(r) => setModal({ condKey: tab.condKey, editing: r })}
                  onCreate={() => setModal({ condKey: tab.condKey, editing: null })}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 20, padding: '12px 16px', background: C.neutralBg, border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cách đọc điều kiện</div>
        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          Trong <b>1 nhóm</b>: tất cả điều kiện phải đúng cùng lúc (VÀ). Giữa các nhóm: chỉ cần <b>1 nhóm</b> đúng là đủ (HOẶC).
          Trạng thái được xét theo thứ tự trên xuống — dòng nào khớp trước sẽ được gán, các dòng sau không còn được xét nữa.
        </div>
      </div>

      {modal && (
        <RuleModal
          open={!!modal}
          editing={modal.editing}
          onClose={() => setModal(null)}
          onSave={(r) => handleSaveRule(modal.condKey, r)}
          onDelete={(r) => handleDeleteRule(modal.condKey, r)}
        />
      )}
    </PageShell>
  )
}
