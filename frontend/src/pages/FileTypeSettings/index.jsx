import { useState, useEffect, useCallback, useMemo } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import { Input, Select, FormRow } from '../../components/Input'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'

const TYPE_COLORS = {
  swift_di: '#2563eb', swift_den: '#7c3aed',
  core: '#059669',
  napas_di: '#d97706', napas_den: '#dc2626', napas_di_fail: '#64748b',
}
const DATA_TYPES = ['string', 'integer', 'number', 'date', 'datetime', 'boolean']

const TRANSFORM_TYPES = [
  { value: '',               label: 'Không có — đọc trực tiếp' },
  { value: 'math',           label: 'Công thức toán' },
  { value: 'regex_extract',  label: 'Xử lý string (Regex)' },
  { value: 'if_else',        label: 'Điều kiện (Nếu / Thì)' },
  { value: 'concat',         label: 'Ghép chuỗi' },
]
const TRANSFORM_LABELS = { math: 'Toán', regex_extract: 'Regex', if_else: 'Điều kiện', concat: 'Ghép chuỗi' }

// Multiple columns can all read from the same source col_name (e.g. teller/
// sequence/trace all extracted from one "DIỄN GIẢI" text cell via different
// regex patterns) — without this, the "Cột trong file" summary shows the
// identical source name for every one of them with no way to tell which
// pattern produces which field.
function describeTransform(t) {
  if (!t?.type) return ''
  if (t.type === 'regex_extract') return `nhóm ${t.group ?? 0}: ${t.pattern || '(chưa có pattern)'}`
  if (t.type === 'math')          return `${MATH_OPS.find(o => o.value === t.op)?.label || t.op} ${t.value ?? ''}`
  if (t.type === 'if_else')       return `nếu ${IF_OPS.find(o => o.value === t.op)?.label || t.op} "${t.cond_value ?? ''}" → "${t.then_value ?? ''}" : "${t.else_value ?? ''}"`
  if (t.type === 'concat')        return `ghép ${t.parts?.length || 0} phần`
  return ''
}
const IF_OPS = [
  { value: 'contains',     label: 'chứa' },
  { value: 'equals',       label: 'bằng đúng' },
  { value: 'starts_with',  label: 'bắt đầu bằng' },
  { value: 'ends_with',    label: 'kết thúc bằng' },
  { value: 'is_empty',     label: 'trống' },
  { value: 'is_not_empty', label: 'không trống' },
]
const MATH_OPS = [
  { value: 'multiply', label: 'Nhân với (×)' },
  { value: 'divide',   label: 'Chia cho (÷)' },
  { value: 'add',      label: 'Cộng thêm (+)' },
  { value: 'subtract', label: 'Trừ đi (−)' },
]

const TH = { padding: '7px 8px', textAlign: 'left', fontSize: 11, color: C.textMuted, fontWeight: 700, borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }

// ── DB ↔ local state mapping ─────────────────────────────────────────────────

function dbToLocal(t) {
  const s = t.fields_schema || {}
  return {
    _dbId:       t.id,
    _dirty:      false,
    type_code:   s.type_code || String(t.id),
    name:        t.upload_name,
    description: s.description || '',
    source:      s.source    || '',   // 'Swift' | 'Core' | 'NAPAS' | '' (chưa gán)
    direction:   s.direction || '',   // 'Đi' | 'Đến' | '' — không áp dụng cho Core (chia theo GHI NỢ/GHI CÓ từng dòng)
    unique_key:  s.unique_key  || [],
    columns: (s.columns || []).map(c => ({
      col_name:      c.col_name      || '',
      field_name:    c.field_name    || '',
      data_type:     c.data_type     || 'string',
      required:      c.required      ?? false,
      allowed_values: c.allowed_values || [],
      fixed_value:   c.fixed_value   ?? null,
      note:          c.note          || '',
      transform:     c.transform     || null,
    })),
  }
}

function localToSchema(ft) {
  const schema = {
    type_code:   ft.type_code,
    description: ft.description,
    source:      ft.source    || undefined,
    direction:   ft.source === 'Core' ? undefined : (ft.direction || undefined),
    columns: ft.columns.map(c => {
      const col = { field_name: c.field_name, data_type: c.data_type, required: c.required, allowed_values: c.allowed_values, note: c.note || '' }
      if (c.transform) col.transform = c.transform
      if (c.fixed_value !== null && c.fixed_value !== undefined && c.fixed_value !== '') {
        col.fixed_value = c.fixed_value
      } else {
        col.col_name = c.col_name
      }
      return col
    }),
  }
  if (ft.unique_key?.length) schema.unique_key = ft.unique_key
  return schema
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FileTypeSettings() {
  const { user } = useAuth()
  const { toast, showConfirm } = useApp()
  const isAdmin = user?.role === 'Admin'
  const [fileTypes, setFileTypes] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(null)
  const [expanded, setExpanded]   = useState(null)
  const [addColModal, setAddColModal]   = useState(null)   // dbId
  const [editColModal, setEditColModal] = useState(null)   // { dbId, idx }
  const [scanModal, setScanModal]       = useState(null)   // dbId
  const [newTypeModal, setNewTypeModal] = useState(false)
  const [scannedCols, setScannedCols]   = useState({})     // dbId → col_name[]

  const load = useCallback(() => {
    setLoading(true)
    api.flex.getTypes('reconcile')
      .then(rows => setFileTypes(rows.map(dbToLocal)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (dbId) => setExpanded(e => e === dbId ? null : dbId)

  const mutate = (dbId, patch) =>
    setFileTypes(prev => prev.map(ft =>
      ft._dbId !== dbId ? ft : { ...ft, ...patch, _dirty: true }
    ))

  const mutateCol = (dbId, idx, patch) =>
    setFileTypes(prev => prev.map(ft => {
      if (ft._dbId !== dbId) return ft
      const cols = ft.columns.map((c, i) => i === idx ? { ...c, ...patch } : c)
      return { ...ft, columns: cols, _dirty: true }
    }))

  const removeCol = (dbId, idx) =>
    setFileTypes(prev => prev.map(ft => {
      if (ft._dbId !== dbId) return ft
      const removed = ft.columns[idx]?.field_name
      const columns = ft.columns.filter((_, i) => i !== idx)
      const unique_key = removed ? (ft.unique_key || []).filter(k => k !== removed) : ft.unique_key
      return { ...ft, columns, unique_key, _dirty: true }
    }))

  const addCol = (dbId, col) =>
    setFileTypes(prev => prev.map(ft => {
      if (ft._dbId !== dbId) return ft
      return { ...ft, columns: [...ft.columns, col], _dirty: true }
    }))

  const addCols = (dbId, newCols) =>
    setFileTypes(prev => prev.map(ft => {
      if (ft._dbId !== dbId) return ft
      return { ...ft, columns: [...ft.columns, ...newCols], _dirty: true }
    }))

  const clearCols = (dbId) =>
    setFileTypes(prev => prev.map(ft =>
      ft._dbId !== dbId ? ft : { ...ft, columns: [], unique_key: [], _dirty: true }
    ))

  const handleSave = async (ft) => {
    setSaving(ft._dbId)
    try {
      await api.flex.patchType(ft._dbId, {
        upload_name:   ft.name,
        fields_schema: localToSchema(ft),
      })
      setFileTypes(prev => prev.map(f => f._dbId === ft._dbId ? { ...f, _dirty: false } : f))
    } catch (e) {
      alert(`Lưu thất bại: ${e.message}`)
    } finally {
      setSaving(null)
    }
  }

  const handleCreate = async (form) => {
    try {
      await api.flex.createType({
        upload_name: form.name,
        fields_schema: { type_code: form.type_code, description: form.description, columns: [] },
      })
      setNewTypeModal(false)
      load()
    } catch (e) {
      alert(`Tạo thất bại: ${e.message}`)
    }
  }

  const handleDeleteType = (ft) => showConfirm({
    title: `Xóa loại file "${ft.name}"?`,
    message: 'Loại file này sẽ không còn hiện ở bất kỳ đâu trong hệ thống. Bị chặn nếu vẫn còn file đã tải lên thuộc loại này.',
    variant: 'danger',
    confirmLabel: 'Xóa',
    onConfirm: () => {
      api.flex.deleteType(ft._dbId)
        .then(() => { load(); toast(`Đã xóa loại file "${ft.name}".`, 'success') })
        .catch(e => toast(e.message || 'Xóa thất bại.', 'error'))
    },
  })

  const editingCol = editColModal
    ? fileTypes.find(ft => ft._dbId === editColModal.dbId)?.columns[editColModal.idx] ?? null
    : null

  const addColFieldOptions = useMemo(() => {
    if (!addColModal) return []
    return (fileTypes.find(ft => ft._dbId === addColModal)?.columns || [])
      .filter(c => !c.fixed_value).map(c => c.field_name).filter(Boolean)
  }, [addColModal, fileTypes])

  const editColFieldOptions = useMemo(() => {
    if (!editColModal) return []
    return (fileTypes.find(ft => ft._dbId === editColModal.dbId)?.columns || [])
      .filter((c, i) => !c.fixed_value && i !== editColModal.idx)
      .map(c => c.field_name).filter(Boolean)
  }, [editColModal, fileTypes])

  if (loading) {
    return (
      <PageShell title="Cấu hình loại file" subtitle="Đang tải từ DB...">
        <div style={{ padding: '60px 0', textAlign: 'center', color: C.textMuted }}>Đang kết nối...</div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Cấu hình loại file"
      subtitle="Định nghĩa cột trong file và cách lưu vào JSON khi upload."
      actions={<Button size="sm" onClick={() => setNewTypeModal(true)}>+ Thêm loại file</Button>}
    >
      <div style={{ padding: '10px 14px', marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: radius.md, fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
        <b>Cách hoạt động:</b> Khi upload file, hệ thống tìm cột theo <b>Tên cột trong file</b>, đọc giá trị, validate, rồi lưu vào JSON với <b>Tên trường đặt</b> làm key.
        Tất cả vào <code style={{ background: '#dcfce7', padding: '1px 5px', borderRadius: 3 }}>uploadedFileRows.file_data</code>.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fileTypes.map(ft => (
          <TypeCard
            key={ft._dbId}
            ft={ft}
            expanded={expanded === ft._dbId}
            isAdmin={isAdmin}
            onToggle={() => toggle(ft._dbId)}
            onMutate={(patch) => mutate(ft._dbId, patch)}
            onRemoveCol={(idx) => removeCol(ft._dbId, idx)}
            onAddCol={() => setAddColModal(ft._dbId)}
            onEditCol={(idx) => setEditColModal({ dbId: ft._dbId, idx })}
            onScanFile={() => setScanModal(ft._dbId)}
            onClearCols={() => clearCols(ft._dbId)}
            onSave={() => handleSave(ft)}
            onDelete={() => handleDeleteType(ft)}
            saving={saving === ft._dbId}
          />
        ))}
      </div>

      <ColFormModal
        open={!!addColModal}
        title="Thêm cột"
        confirmLabel="Thêm"
        initial={null}
        fieldOptions={addColFieldOptions}
        knownCols={scannedCols[addColModal] || []}
        onClose={() => setAddColModal(null)}
        onConfirm={(col) => { addCol(addColModal, col); setAddColModal(null) }}
      />

      <ColFormModal
        open={!!editColModal}
        title="Sửa cột"
        confirmLabel="Lưu"
        initial={editingCol}
        fieldOptions={editColFieldOptions}
        knownCols={scannedCols[editColModal?.dbId] || []}
        onClose={() => setEditColModal(null)}
        onConfirm={(col) => { mutateCol(editColModal.dbId, editColModal.idx, col); setEditColModal(null) }}
      />

      <ScanFileModal
        open={!!scanModal}
        onClose={() => setScanModal(null)}
        onAddCols={(cols, allColNames) => {
          addCols(scanModal, cols)
          if (allColNames?.length) setScannedCols(prev => ({ ...prev, [scanModal]: allColNames }))
          setScanModal(null)
        }}
      />

      <NewTypeModal open={newTypeModal} onClose={() => setNewTypeModal(false)} onCreate={handleCreate} />
    </PageShell>
  )
}

// ── Type Card ─────────────────────────────────────────────────────────────────

function TypeCard({ ft, expanded, isAdmin, onToggle, onMutate, onRemoveCol, onAddCol, onEditCol, onScanFile, onClearCols, onSave, onDelete, saving }) {
  const color = TYPE_COLORS[ft.type_code] ?? C.primary

  return (
    <div style={{
      background: '#fff',
      borderTop:    `1px solid ${ft._dirty ? '#f59e0b' : C.cardBorder}`,
      borderRight:  `1px solid ${ft._dirty ? '#f59e0b' : C.cardBorder}`,
      borderBottom: `1px solid ${ft._dirty ? '#f59e0b' : C.cardBorder}`,
      borderLeft:   `4px solid ${color}`,
      borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden',
    }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', borderBottom: expanded ? `1px solid ${C.cardBorder}` : 'none' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ft.name}</span>
            {ft._dirty && <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '1px 7px', borderRadius: 10 }}>Chưa lưu</span>}
          </div>
          {ft.description && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{ft.description}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Badge variant="neutral">{ft.columns.length} cột</Badge>
          {isAdmin && (
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              title={`Xóa loại file "${ft.name}"`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 13, padding: '0 2px', lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.color = C.error }}
              onMouseLeave={e => { e.currentTarget.style.color = C.textLight }}
            >🗑</button>
          )}
          <span style={{ color: C.textLight, fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
            <FormRow label="Tên hiển thị">
              <Input value={ft.name} onChange={e => onMutate({ name: e.target.value })} />
            </FormRow>
            <FormRow label="Mô tả">
              <Input value={ft.description} onChange={e => onMutate({ description: e.target.value })} placeholder="Mô tả ngắn..." />
            </FormRow>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: ft.source === 'Core' ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <FormRow label="Nguồn dữ liệu" hint="Dùng để Cấu hình đối chiếu và các trang tổng hợp biết loại file này thuộc hệ thống nào">
              <Select value={ft.source} onChange={e => onMutate({ source: e.target.value })}>
                <option value="">-- chưa gán --</option>
                <option value="Swift">Swift</option>
                <option value="Core">Core</option>
                <option value="NAPAS">NAPAS</option>
              </Select>
            </FormRow>
            {ft.source && ft.source !== 'Core' && (
              <FormRow label="Chiều giao dịch" hint="Core không cần chọn — hệ thống tự phân theo cột SỐ TIỀN GHI NỢ/GHI CÓ của từng dòng">
                <Select value={ft.direction} onChange={e => onMutate({ direction: e.target.value })}>
                  <option value="">-- chưa gán --</option>
                  <option value="Đi">Đi</option>
                  <option value="Đến">Đến</option>
                </Select>
              </FormRow>
            )}
          </div>

          <SectionLabel>Cột dữ liệu</SectionLabel>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 10, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: C.neutralBg }}>
                {['Cột trong file', 'Tên trường đặt', 'Kiểu dữ liệu', 'Bắt buộc', 'Giá trị được phép', 'Ghi chú', ''].map(h => (
                  <th key={h} style={{ ...TH, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ft.columns.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '20px 10px', textAlign: 'center', color: C.textLight, fontSize: 12 }}>Chưa có cột nào — quét file mẫu hoặc nhấn "+ Thêm cột"</td></tr>
              ) : ft.columns.map((col, idx) => (
                <ColRow key={idx} col={col} onEdit={() => onEditCol(idx)} onRemove={() => onRemoveCol(idx)} />
              ))}
            </tbody>
          </table>

          <UniqueKeySection ft={ft} onMutate={onMutate} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button size="sm" variant="subtle" onClick={onScanFile}>Quét file mẫu</Button>
            <Button size="sm" variant="subtle" onClick={onAddCol}>+ Thêm cột thủ công</Button>
            {ft.columns.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(`Xóa toàn bộ ${ft.columns.length} cột của "${ft.name}"?\nCần nhấn "Lưu thay đổi" để áp dụng.`))
                    onClearCols()
                }}
                style={{ background: 'none', border: `1px solid ${C.errorBorder}`, color: C.error, cursor: 'pointer', fontSize: 11, borderRadius: 4, padding: '4px 10px', fontFamily: 'inherit' }}
              >
                Xóa tất cả cột
              </button>
            )}
            <div style={{ flex: 1 }} />
            <Button
              size="sm"
              disabled={!ft._dirty || saving}
              onClick={onSave}
              style={ft._dirty ? { background: C.primary, color: '#fff', borderColor: C.primary } : {}}
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Column Row (read-only) ────────────────────────────────────────────────────

function ColRow({ col, onEdit, onRemove }) {
  const isFixed = col.fixed_value !== null && col.fixed_value !== undefined && col.fixed_value !== ''

  return (
    <tr style={{ borderBottom: `1px solid ${C.cardBorder}`, background: isFixed ? '#fafaf7' : 'transparent' }}>
      {/* Cột trong file */}
      <td style={{ padding: '8px 10px' }}>
        {isFixed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap' }}>TỰ ĐIỀN</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#92400e', fontWeight: 600 }}>{col.fixed_value}</span>
          </div>
        ) : (
          <div>
            <span style={{ fontSize: 12, color: C.textMuted, fontFamily: 'monospace' }}>{col.col_name || <i style={{ color: C.textLight }}>—</i>}</span>
            {col.transform?.type && (
              <div
                style={{ fontSize: 10, color: '#7c3aed', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={describeTransform(col.transform)}
              >
                ƒ {TRANSFORM_LABELS[col.transform.type] || col.transform.type}
                {': '}
                <span style={{ fontFamily: 'monospace' }}>{describeTransform(col.transform)}</span>
              </div>
            )}
          </div>
        )}
      </td>
      {/* Tên trường đặt */}
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.primary, fontWeight: 600 }}>{col.field_name}</span>
      </td>
      {/* Kiểu dữ liệu */}
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: C.neutralBg, color: C.textMuted, fontWeight: 500 }}>{col.data_type}</span>
      </td>
      {/* Bắt buộc */}
      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
        {col.required ? <span style={{ color: C.error, fontWeight: 700, fontSize: 13 }}>✓</span> : <span style={{ color: C.textLight }}>—</span>}
      </td>
      {/* Giá trị được phép */}
      <td style={{ padding: '8px 10px', minWidth: 140 }}>
        {col.allowed_values && col.allowed_values.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {col.allowed_values.map((v, i) => (
              <span key={i} style={{ padding: '2px 8px', background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 12, fontSize: 11, fontWeight: 500 }}>{v}</span>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>Không giới hạn</span>
        )}
      </td>
      {/* Ghi chú */}
      <td style={{ padding: '8px 10px', maxWidth: 160 }}>
        {col.note
          ? <span style={{ fontSize: 11, color: C.textMuted, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col.note}>{col.note}</span>
          : <span style={{ fontSize: 11, color: C.textLight }}>—</span>}
      </td>
      {/* Hành động */}
      <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <button onClick={onEdit} style={{ background: 'none', border: `1px solid ${C.cardBorder}`, cursor: 'pointer', color: C.textMuted, fontSize: 11, borderRadius: 4, padding: '2px 8px', marginRight: 4 }}>Sửa</button>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 16, lineHeight: 1 }}>×</button>
      </td>
    </tr>
  )
}

// ── Unique Key Section ────────────────────────────────────────────────────────

function UniqueKeySection({ ft, onMutate }) {
  const candidates = ft.columns.filter(c => !c.fixed_value)
  const selected   = ft.unique_key || []

  const toggle = (fieldName) => {
    const next = selected.includes(fieldName)
      ? selected.filter(k => k !== fieldName)
      : [...selected, fieldName]
    onMutate({ unique_key: next })
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <SectionLabel>Trường khóa (Unique Key)</SectionLabel>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
        Khi upload file trùng, các dòng có cùng tổ hợp khóa này sẽ bị bỏ qua.
      </div>
      {candidates.length === 0 ? (
        <span style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic' }}>Chưa có cột từ file — thêm cột trước</span>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {candidates.map(c => {
            const on = selected.includes(c.field_name)
            return (
              <label key={c.field_name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', padding: '3px 10px', border: `1px solid ${on ? C.primary : C.cardBorder}`, borderRadius: 20, background: on ? C.primaryLight : 'transparent', userSelect: 'none' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(c.field_name)} style={{ accentColor: C.primary, width: 12, height: 12 }} />
                <span style={{ fontFamily: 'monospace', color: on ? C.primary : C.textMuted, fontWeight: on ? 600 : 400 }}>{c.field_name}</span>
              </label>
            )
          })}
          {selected.length > 0 && (
            <span style={{ fontSize: 11, color: C.textMuted, alignSelf: 'center', marginLeft: 4 }}>
              → key: <b style={{ fontFamily: 'monospace', color: C.primary }}>{selected.join(' + ')}</b>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Column Form Modal (Add & Edit) ────────────────────────────────────────────

function ColFormModal({ open, title, confirmLabel, initial, onClose, onConfirm, fieldOptions = [], knownCols = [] }) {
  const isEditMode = initial !== null && initial !== undefined
  const [isFixed, setIsFixed] = useState(false)
  const [form, setForm] = useState({ col_name: '', field_name: '', data_type: 'string', required: false, allowed_values: [], fixed_value: '', note: '' })
  const [transformConfig, setTransformConfig] = useState(null)
  const [avInput, setAvInput] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!open) return
    if (initial) {
      const isF = initial.fixed_value !== null && initial.fixed_value !== undefined && initial.fixed_value !== ''
      setIsFixed(isF)
      setForm({
        col_name:      initial.col_name      || '',
        field_name:    initial.field_name    || '',
        data_type:     initial.data_type     || 'string',
        required:      initial.required      ?? false,
        allowed_values: initial.allowed_values || [],
        fixed_value:   initial.fixed_value   || '',
        note:          initial.note          || '',
      })
      setTransformConfig(initial.transform || null)
    } else {
      setIsFixed(false)
      setForm({ col_name: '', field_name: '', data_type: 'string', required: false, allowed_values: [], fixed_value: '', note: '' })
      setTransformConfig(null)
    }
    setAvInput('')
  }, [open])

  const handleConfirm = () => {
    if (!form.field_name.trim()) return
    if (isFixed && !form.fixed_value.trim()) return
    if (!isFixed && !form.col_name.trim()) return
    const transform = !isFixed ? transformConfig : null
    onConfirm({
      field_name:    form.field_name,
      data_type:     form.data_type,
      required:      isFixed ? false : form.required,
      allowed_values: isFixed ? [] : form.allowed_values,
      note:          form.note,
      transform,
      ...(isFixed
        ? { fixed_value: form.fixed_value, col_name: '' }
        : { col_name: form.col_name, fixed_value: null }),
    })
  }

  return (
    <Modal open={open} title={title} onClose={onClose} onConfirm={handleConfirm} confirmLabel={confirmLabel} width={500}>
      {/* Nguồn dữ liệu toggle — không đổi được khi sửa */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Nguồn dữ liệu</div>
        <div style={{ display: 'flex', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md, overflow: 'hidden', opacity: isEditMode ? 0.6 : 1, pointerEvents: isEditMode ? 'none' : 'auto' }}>
          {[{ v: false, label: 'Đọc từ file' }, { v: true, label: 'Giá trị tự điền' }].map(opt => (
            <button key={String(opt.v)} onClick={() => setIsFixed(opt.v)}
              style={{ flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: isFixed === opt.v ? 700 : 500, fontFamily: 'inherit',
                background: isFixed === opt.v ? C.primary : '#fff', color: isFixed === opt.v ? '#fff' : C.textMuted, transition: 'all 0.12s' }}>
              {opt.label}
            </button>
          ))}
        </div>
        {isEditMode && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Không thể thay đổi nguồn dữ liệu của cột đã tạo.</div>}
      </div>

      {/* 1. Tên trường đặt */}
      <FormRow label="Tên trường đặt *">
        <Input
          placeholder="VD: trace"
          value={form.field_name}
          onChange={e => set('field_name', e.target.value.replace(/\s+/g, '_').toLowerCase())}
          style={{ fontFamily: 'monospace' }}
        />
      </FormRow>

      {/* 2. Cột trong file hoặc Giá trị cố định */}
      {isFixed ? (
        <FormRow label="Giá trị cố định *">
          <Input
            placeholder="VD: DI"
            value={form.fixed_value}
            onChange={e => set('fixed_value', e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Tự điền vào mọi dòng khi upload, không đọc từ file</div>
        </FormRow>
      ) : (
        <FormRow label="Tên cột trong file *">
          {isEditMode ? (
            <div style={{ padding: '6px 10px', background: C.neutralBg, borderRadius: radius.sm, fontFamily: 'monospace', fontSize: 13, color: C.text, border: `1px solid ${C.cardBorder}` }}>
              {form.col_name || <span style={{ color: C.textLight, fontStyle: 'italic' }}>—</span>}
            </div>
          ) : (
            <>
              <Input
                list="col-name-datalist"
                placeholder={knownCols.length ? 'Chọn hoặc nhập tên cột...' : 'VD: TRACE NUMBER'}
                value={form.col_name}
                onChange={e => set('col_name', e.target.value)}
              />
              <datalist id="col-name-datalist">
                {knownCols.map(c => <option key={c} value={c} />)}
              </datalist>
              {knownCols.length > 0 && (
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                  {knownCols.length} cột từ lần quét gần nhất — nhấn mũi tên để chọn
                </div>
              )}
            </>
          )}
          {!isEditMode && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Phải khớp tiêu đề cột trong file (không phân biệt hoa thường)</div>}
          {isEditMode && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Tên cột trong file không thể sửa.</div>}
        </FormRow>
      )}

      {/* 3. Xử lý đặc biệt (transform) — chỉ khi đọc từ file */}
      {!isFixed && (
        <FormRow label="Xử lý đặc biệt">
          <TransformEditor value={transformConfig} onChange={setTransformConfig} fieldOptions={fieldOptions} />
        </FormRow>
      )}

      {/* 4. Kiểu dữ liệu + Bắt buộc */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginBottom: 12 }}>
        <FormRow label="Kiểu dữ liệu">
          <Select value={form.data_type} onChange={e => set('data_type', e.target.value)}>
            {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormRow>
        {!isFixed && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', paddingBottom: 2 }}>
            <input type="checkbox" checked={form.required} onChange={e => set('required', e.target.checked)} style={{ accentColor: C.error, width: 14, height: 14 }} />
            Bắt buộc
          </label>
        )}
      </div>

      {/* 5. Giá trị được phép */}
      {!isFixed && (
        <FormRow label="Giá trị được phép (Enter để thêm — để trống = không giới hạn)">
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <Input value={avInput} onChange={e => setAvInput(e.target.value)} placeholder="VD: THANH CONG"
              onKeyDown={e => { if (e.key === 'Enter' && avInput.trim()) { set('allowed_values', [...form.allowed_values, avInput.trim()]); setAvInput('') } }} />
            <Button size="sm" variant="subtle" onClick={() => { if (avInput.trim()) { set('allowed_values', [...form.allowed_values, avInput.trim()]); setAvInput('') } }}>Thêm</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {form.allowed_values.map((v, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: C.primaryLight, color: C.primary, border: `1px solid ${C.primaryBorder}`, borderRadius: 20, fontSize: 12 }}>
                {v}
                <button onClick={() => set('allowed_values', form.allowed_values.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        </FormRow>
      )}

      {/* 6. Ghi chú */}
      <FormRow label="Ghi chú">
        <Input placeholder="VD: Chuẩn hóa sang YYYYMMDD khi parse" value={form.note} onChange={e => set('note', e.target.value)} />
      </FormRow>
    </Modal>
  )
}

// ── Transform Editor + Sub-editors ───────────────────────────────────────────

function TransformEditor({ value, onChange, fieldOptions }) {
  const type = value?.type || ''

  const handleTypeChange = (newType) => {
    if (!newType) { onChange(null); return }
    if (newType === type) return
    if (newType === 'math')          onChange({ type: 'math', op: 'multiply', value: '1' })
    else if (newType === 'regex_extract') onChange({ type: 'regex_extract', pattern: '', group: 0 })
    else if (newType === 'if_else')  onChange({ type: 'if_else', op: 'contains', cond_value: '', then_value: '', else_value: '' })
    else if (newType === 'concat')   onChange({ type: 'concat', parts: [] })
  }

  return (
    <div>
      <Select value={type} onChange={e => handleTypeChange(e.target.value)}>
        {TRANSFORM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </Select>
      {type === 'math'          && <MathEditor   value={value} onChange={onChange} />}
      {type === 'regex_extract' && <RegexEditor  value={value} onChange={onChange} />}
      {type === 'if_else'       && <IfElseEditor value={value} onChange={onChange} />}
      {type === 'concat'        && <ConcatEditor value={value} onChange={onChange} fieldOptions={fieldOptions} />}
    </div>
  )
}

function MathEditor({ value, onChange }) {
  const patch = (k, v) => onChange({ ...value, [k]: v })
  const op = value?.op || 'multiply'
  const num = value?.value ?? '1'
  const exampleResult = (() => {
    try {
      const n = 100, operand = parseFloat(num)
      if (op === 'multiply') return n * operand
      if (op === 'divide')   return operand !== 0 ? +(n / operand).toFixed(4) : '∞'
      if (op === 'add')      return n + operand
      if (op === 'subtract') return n - operand
    } catch { return '?' }
  })()

  return (
    <div style={{ marginTop: 8, padding: '12px', background: C.neutralBg, border: `1px solid ${C.cardBorder}`, borderRadius: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>Giá trị đọc được</span>
        <Select value={op} onChange={e => patch('op', e.target.value)} style={{ width: 'auto' }}>
          {MATH_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Input
          type="number"
          value={num}
          onChange={e => patch('value', e.target.value)}
          style={{ width: 90 }}
          placeholder="VD: 1000"
        />
      </div>
      <div style={{ fontSize: 11, color: C.textMuted }}>
        Ví dụ: nếu file có giá trị <b>100</b> → kết quả sẽ là <b style={{ color: C.primary }}>{exampleResult}</b>
      </div>
    </div>
  )
}

function RegexEditor({ value, onChange }) {
  const patch = (k, v) => onChange({ ...value, [k]: v })
  const [testInput, setTestInput] = useState('')

  const preview = useMemo(() => {
    if (!testInput || !value?.pattern) return null
    try {
      const m = testInput.match(new RegExp(value.pattern))
      if (!m) return { ok: false, result: 'Không khớp' }
      const g = Number(value?.group ?? 0)
      const result = g === 0 ? m[0] : (m[g] ?? null)
      return { ok: result !== null, result: result !== null ? String(result) : `Không có nhóm ${g}` }
    } catch (e) {
      return { ok: false, result: `Regex lỗi: ${e.message}` }
    }
  }, [testInput, value?.pattern, value?.group])

  return (
    <div style={{ marginTop: 8, padding: '12px', background: C.neutralBg, border: `1px solid ${C.cardBorder}`, borderRadius: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Pattern (biểu thức tìm kiếm)</div>
          <Input
            value={value?.pattern || ''}
            onChange={e => patch('pattern', e.target.value)}
            placeholder="VD: CREDMBNEO\\.\\d+\\.(\\d+)"
            style={{ fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Nhóm (#)</div>
          <Input type="number" min={0} max={9} value={value?.group ?? 0} onChange={e => patch('group', Number(e.target.value))} />
        </div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>Thử nghiệm — dán giá trị mẫu từ file:</div>
        <Input
          value={testInput}
          onChange={e => setTestInput(e.target.value)}
          placeholder="VD: CREDMBNEO.123.456789"
          style={{ fontFamily: 'monospace', fontSize: 11 }}
        />
      </div>
      {preview && (
        <div style={{ padding: '6px 10px', background: preview.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${preview.ok ? '#bbf7d0' : '#fecaca'}`, borderRadius: 4, fontSize: 12, fontFamily: 'monospace', color: preview.ok ? '#166534' : '#dc2626' }}>
          → {preview.result}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted }}>
        <b>Nhóm 0</b> = toàn bộ phần khớp · <b>1, 2…</b> = nhóm trong dấu ngoặc <code>()</code>
      </div>
    </div>
  )
}

function IfElseEditor({ value, onChange }) {
  const patch = (k, v) => onChange({ ...value, [k]: v })
  const op = value?.op || 'contains'
  const showCondValue = !['is_empty', 'is_not_empty'].includes(op)

  return (
    <div style={{ marginTop: 8, padding: '12px', background: C.neutralBg, border: `1px solid ${C.cardBorder}`, borderRadius: 6 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>Điều kiện kiểm tra</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' }}>Nếu giá trị</span>
          <Select value={op} onChange={e => patch('op', e.target.value)} style={{ width: 'auto', fontSize: 12 }}>
            {IF_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          {showCondValue && (
            <Input
              value={value?.cond_value || ''}
              onChange={e => patch('cond_value', e.target.value)}
              placeholder="Giá trị so sánh..."
              style={{ width: 130, fontSize: 12 }}
            />
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginBottom: 4 }}>Thì ghi</div>
          <Input
            value={value?.then_value || ''}
            onChange={e => patch('then_value', e.target.value)}
            placeholder="Giá trị khi đúng..."
            style={{ fontSize: 12 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>Ngược lại ghi</div>
          <Input
            value={value?.else_value || ''}
            onChange={e => patch('else_value', e.target.value)}
            placeholder="Để trống = giữ nguyên giá trị"
            style={{ fontSize: 12 }}
          />
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
        Ví dụ: Nếu giá trị <b>chứa "DI"</b> thì ghi <b>"Chuyển đi"</b>, ngược lại ghi <b>"Chuyển đến"</b>
      </div>
    </div>
  )
}

function ConcatEditor({ value, onChange, fieldOptions }) {
  const parts = value?.parts || []
  const addPart = (kind) => {
    const p = kind === 'field'
      ? { kind: 'field', field_name: fieldOptions[0] || '' }
      : { kind: 'literal', value: '' }
    onChange({ ...value, parts: [...parts, p] })
  }
  const removePart = (i) => onChange({ ...value, parts: parts.filter((_, idx) => idx !== i) })
  const updatePart = (i, patch) => onChange({ ...value, parts: parts.map((p, idx) => idx === i ? { ...p, ...patch } : p) })

  const preview = parts.map(p =>
    p.kind === 'field' ? `[${p.field_name || '?'}]` : (p.value || '')
  ).join('')

  return (
    <div style={{ marginTop: 8, padding: '12px', background: C.neutralBg, border: `1px solid ${C.cardBorder}`, borderRadius: 6 }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
        Xây dựng kết quả bằng cách ghép các phần theo thứ tự:
      </div>

      {parts.length === 0 ? (
        <div style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: C.textLight, border: `1px dashed ${C.cardBorder}`, borderRadius: 4, marginBottom: 8 }}>
          Chưa có phần nào — nhấn nút bên dưới để thêm
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, padding: '8px', background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 4, alignItems: 'center' }}>
          {parts.map((p, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: `1px solid ${p.kind === 'field' ? C.primary : '#d97706'}`, borderRadius: 14, background: p.kind === 'field' ? C.primaryLight : '#fef3c7', fontSize: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: p.kind === 'field' ? '#7c3aed' : '#92400e', textTransform: 'uppercase', marginRight: 2 }}>{p.kind === 'field' ? 'Trường' : 'Text'}</span>
              {p.kind === 'field' ? (
                fieldOptions.length > 0
                  ? <Select value={p.field_name} onChange={e => updatePart(i, { field_name: e.target.value })}
                      style={{ border: 'none', background: 'transparent', fontSize: 11, fontFamily: 'monospace', color: C.primary, padding: '0 2px', height: 'auto', outline: 'none', cursor: 'pointer' }}>
                      {fieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
                    </Select>
                  : <span style={{ fontSize: 11, color: C.textLight, fontStyle: 'italic' }}>chưa có trường</span>
              ) : (
                <input
                  value={p.value}
                  onChange={e => updatePart(i, { value: e.target.value })}
                  placeholder="text..."
                  style={{ border: 'none', background: 'transparent', fontSize: 11, color: '#92400e', padding: '0 2px', outline: 'none', width: Math.max(40, (p.value?.length || 6) * 7 + 10), fontFamily: 'inherit' }}
                />
              )}
              <button onClick={() => removePart(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 13, lineHeight: 1, padding: '0 1px', marginLeft: 2 }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: parts.length > 0 ? 8 : 0 }}>
        <button onClick={() => addPart('field')} disabled={fieldOptions.length === 0}
          title={fieldOptions.length === 0 ? 'Cần có cột từ file để tham chiếu' : ''}
          style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${C.primary}`, borderRadius: 14, background: C.primaryLight, color: C.primary, cursor: fieldOptions.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: fieldOptions.length === 0 ? 0.5 : 1 }}>
          + Thêm TRƯỜNG
        </button>
        <button onClick={() => addPart('literal')}
          style={{ fontSize: 11, padding: '4px 10px', border: `1px solid #d97706`, borderRadius: 14, background: '#fef3c7', color: '#92400e', cursor: 'pointer', fontFamily: 'inherit' }}>
          + Thêm TEXT
        </button>
      </div>

      {parts.length > 0 && (
        <div style={{ padding: '6px 10px', background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>
          Kết quả mẫu: <b style={{ color: C.primary }}>{preview || '(trống)'}</b>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
        Ví dụ: <b>[trace]</b> + TEXT "<b>-</b>" + <b>[ngay]</b> → <span style={{ fontFamily: 'monospace' }}>123456-20240101</span>
      </div>
    </div>
  )
}

// ── Scan File Modal ───────────────────────────────────────────────────────────

function ScanFileModal({ open, onClose, onAddCols }) {
  const [step, setStep]           = useState('upload')
  const [file, setFile]           = useState(null)
  const [scanning, setScanning]   = useState(false)
  const [cols, setCols]           = useState([])
  const [scanError, setScanError] = useState('')
  const [headerRow, setHeaderRow] = useState(null)

  const reset = () => { setStep('upload'); setFile(null); setCols([]); setScanError(''); setHeaderRow(null) }
  const handleClose = () => { reset(); onClose() }

  const handleScan = async () => {
    if (!file) return
    setScanning(true)
    setScanError('')
    try {
      const res = await api.flex.scanFile(file)
      const columns = Array.isArray(res?.columns) ? res.columns : []
      if (columns.length === 0) {
        setScanError('Không tìm thấy cột nào. Thử upload file với header rõ ràng hơn.')
        return
      }
      setHeaderRow(res.header_row ?? null)
      setCols(columns.map(c => {
        const col_name = typeof c === 'string' ? c : c.col_name
        const suggested_type = typeof c === 'object' ? (c.suggested_type || 'string') : 'string'
        return {
          col_name,
          include: true,
          field_name: col_name.toLowerCase().replace(/\s+/g, '_'),
          data_type: suggested_type,
          required: false,
          note: '',
        }
      }))
      setStep('configure')
    } catch (e) {
      setScanError(`Lỗi: ${e.message}`)
    } finally {
      setScanning(false)
    }
  }

  const toggleAll = (v) => setCols(prev => prev.map(c => ({ ...c, include: v })))
  const updateCol = (i, patch) => setCols(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c))

  const selectedCount = cols.filter(c => c.include).length

  const handleConfirm = () => {
    if (step === 'upload') { handleScan(); return }
    const selected = cols.filter(c => c.include && c.field_name.trim())
    if (!selected.length) return
    const allColNames = cols.map(c => c.col_name)
    onAddCols(selected.map(c => ({
      col_name:      c.col_name,
      field_name:    c.field_name.trim(),
      data_type:     c.data_type,
      required:      c.required,
      allowed_values: [],
      fixed_value:   null,
      note:          c.note || '',
    })), allColNames)
    reset()
  }

  const confirmLabel = step === 'upload'
    ? (scanning ? 'Đang quét...' : (file ? 'Quét cột' : 'Chọn file trước'))
    : `Thêm ${selectedCount} cột đã chọn`

  return (
    <Modal open={open} title="Quét file mẫu" onClose={handleClose} onConfirm={handleConfirm} confirmLabel={confirmLabel} width={step === 'configure' ? 960 : 460}>
      {step === 'upload' && (
        <div>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
            Upload file Excel mẫu. Hệ thống đọc dòng tiêu đề và liệt kê các cột để bạn cấu hình — không lưu dữ liệu.
          </p>
          <label
            htmlFor="scan-file-input"
            style={{ display: 'block', border: `2px dashed ${file ? C.primary : C.cardBorder}`, borderRadius: radius.md, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: file ? C.primaryLight : C.neutralBg, transition: 'all 0.15s' }}
          >
            <input id="scan-file-input" type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { setFile(e.target.files[0] || null); setScanError('') }} />
            {file ? (
              <>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📄</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{file.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Nhấn để chọn file khác</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, marginBottom: 6 }}>📂</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>Nhấn để chọn file Excel (.xlsx / .xls)</div>
              </>
            )}
          </label>
          {scanError && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: radius.sm, fontSize: 12, color: '#dc2626' }}>
              {scanError}
            </div>
          )}
        </div>
      )}

      {step === 'configure' && (
        <div>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: C.textMuted }}>
              Tìm thấy <b>{cols.length} cột</b> trong <b>{file?.name}</b>
              {headerRow != null && <span style={{ color: C.textLight }}> · header phát hiện ở hàng {headerRow}</span>}
              . Chọn cột cần thêm và đặt tên trong hệ thống.
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => toggleAll(true)} style={{ fontSize: 11, padding: '3px 8px', border: `1px solid ${C.cardBorder}`, borderRadius: 4, background: 'none', cursor: 'pointer', color: C.textMuted }}>Chọn tất cả</button>
              <button onClick={() => toggleAll(false)} style={{ fontSize: 11, padding: '3px 8px', border: `1px solid ${C.cardBorder}`, borderRadius: 4, background: 'none', cursor: 'pointer', color: C.textMuted }}>Bỏ chọn</button>
              <button onClick={() => setStep('upload')} style={{ fontSize: 11, padding: '3px 8px', border: `1px solid ${C.cardBorder}`, borderRadius: 4, background: 'none', cursor: 'pointer', color: C.textMuted }}>← Đổi file</button>
            </div>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ background: C.neutralBg }}>
                  <th style={{ ...TH, width: 36, textAlign: 'center' }}></th>
                  <th style={TH}>Cột trong file</th>
                  <th style={TH}>Tên trường đặt</th>
                  <th style={TH}>Kiểu dữ liệu</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Bắt buộc</th>
                  <th style={TH}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {cols.map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}`, opacity: c.include ? 1 : 0.35, transition: 'opacity 0.1s' }}>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <input type="checkbox" checked={c.include} onChange={e => updateCol(i, { include: e.target.checked })} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>{c.col_name}</span>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <Input
                        value={c.field_name}
                        onChange={e => updateCol(i, { field_name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                        disabled={!c.include}
                        style={{ fontSize: 11, padding: '3px 6px', fontFamily: 'monospace', color: C.primary, minWidth: 100 }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <Select value={c.data_type} onChange={e => updateCol(i, { data_type: e.target.value })} disabled={!c.include} style={{ fontSize: 11, padding: '3px 6px' }}>
                        {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <input type="checkbox" checked={c.required} disabled={!c.include} onChange={e => updateCol(i, { required: e.target.checked })} style={{ accentColor: C.error, width: 14, height: 14, cursor: c.include ? 'pointer' : 'default' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <Input
                        value={c.note || ''}
                        onChange={e => updateCol(i, { note: e.target.value })}
                        disabled={!c.include}
                        placeholder="Ghi chú..."
                        style={{ fontSize: 11, padding: '3px 6px', minWidth: 120 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted }}>
            Giá trị được phép và Ghi chú có thể đặt sau bằng nút "Sửa" trên từng cột.
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── New Type Modal ────────────────────────────────────────────────────────────

function NewTypeModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', type_code: '', description: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onCreate(form)
    setSaving(false)
    setForm({ name: '', type_code: '', description: '' })
  }

  return (
    <Modal open={open} title="Thêm loại file mới" onClose={onClose} onConfirm={handleCreate} confirmLabel={saving ? 'Đang tạo...' : 'Tạo'} width={480}>
      <FormRow label="Tên hiển thị *">
        <Input placeholder="VD: VietQR Đến" value={form.name} onChange={e => set('name', e.target.value)} />
      </FormRow>
      <FormRow label="Mã nội bộ (type code)">
        <Input placeholder="VD: vietqr_den" value={form.type_code} onChange={e => set('type_code', e.target.value.replace(/\s+/g, '_').toLowerCase())} style={{ fontFamily: 'monospace' }} />
      </FormRow>
      <FormRow label="Mô tả">
        <Input placeholder="Mô tả ngắn..." value={form.description} onChange={e => set('description', e.target.value)} />
      </FormRow>
      <div style={{ fontSize: 11, color: C.textMuted, padding: '8px 12px', background: C.neutralBg, borderRadius: radius.sm }}>
        Sau khi tạo, dùng <b>"Quét file mẫu"</b> để tự động phát hiện các cột, hoặc <b>"+ Thêm cột thủ công"</b>.
      </div>
    </Modal>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</div>
}
