import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Button from '../../components/Button'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import { Input, Select, FormRow } from '../../components/Input'
import { C, radius, shadow } from '../../theme'

const TYPE_COLORS = {
  swift_di: '#2563eb', swift_den: '#7c3aed',
  core: '#059669',
  napas_di: '#d97706', napas_den: '#dc2626', napas_di_fail: '#64748b',
}

const DEFAULT_FILE_TYPES = [
  {
    id: 'swift_di', name: 'Swift Report Đi', storageTable: 'Swift',
    description: 'Báo cáo giao dịch chuyển tiền đi qua Swift',
    acceptedExtensions: ['.xlsx', '.xls'],
    fields: [
      { key: 'seq',      label: 'SEQ',           alias: 'seq',      type: 'integer', required: true,  allowedValues: [],                                  storageCol: 'seq'      },
      { key: 'trace',    label: 'TRACE NUMBER',   alias: 'trace',    type: 'integer', required: true,  allowedValues: [],                                  storageCol: 'trace'    },
      { key: 'hostdate', label: 'HOSTDATE',       alias: 'hostdate', type: 'date',    required: true,  allowedValues: [],                                  storageCol: 'hostdate' },
      { key: 'amount',   label: 'SỐ TIỀN',        alias: 'amount',   type: 'number',  required: true,  allowedValues: [],                                  storageCol: 'amount'   },
      { key: 'status',   label: 'PHẢN HỒI',       alias: 'status',   type: 'string',  required: true,  allowedValues: ['THANH CONG','TIMEOUT','THAT BAI'], storageCol: 'status'   },
    ],
  },
  {
    id: 'swift_den', name: 'Swift Report Đến', storageTable: 'Swift',
    description: 'Báo cáo giao dịch chuyển tiền đến qua Swift',
    acceptedExtensions: ['.xlsx', '.xls'],
    fields: [
      { key: 'seq',      label: 'SEQ',       alias: 'seq',      type: 'integer', required: false, allowedValues: [],                        storageCol: 'seq'      },
      { key: 'trace',    label: 'TRACE',     alias: 'trace',    type: 'integer', required: true,  allowedValues: [],                        storageCol: 'trace'    },
      { key: 'hostdate', label: 'HOST DATE', alias: 'hostdate', type: 'date',    required: true,  allowedValues: [],                        storageCol: 'hostdate' },
      { key: 'amount',   label: 'SỐ TIỀN',   alias: 'amount',   type: 'number',  required: true,  allowedValues: [],                        storageCol: 'amount'   },
      { key: 'status',   label: 'PHẢN HỒI',  alias: 'status',   type: 'string',  required: true,  allowedValues: ['THANH CONG','THAT BAI'], storageCol: 'status'   },
    ],
  },
  {
    id: 'core', name: 'Core (Ghi có / Ghi nợ)', storageTable: 'Core',
    description: 'Dữ liệu giao dịch từ hệ thống Core Banking',
    acceptedExtensions: ['.xlsx', '.xls'],
    fields: [
      { key: 'dien_giai', label: 'DIỄN GIẢI', alias: 'dien_giai', type: 'string',  required: true,  allowedValues: [],         storageCol: 'dien_giai' },
      { key: 'teller',    label: 'TELLER',    alias: 'teller',    type: 'integer', required: false, allowedValues: [],         storageCol: 'teller'    },
      { key: 'seq',       label: 'SEQ',       alias: 'seq',       type: 'integer', required: false, allowedValues: [],         storageCol: 'seq'       },
      { key: 'trace',     label: 'TRACE',     alias: 'trace',     type: 'integer', required: false, allowedValues: [],         storageCol: 'trace'     },
      { key: 'kind',      label: 'Loại GD',   alias: 'kind',      type: 'string',  required: false, allowedValues: ['DI','DEN'], storageCol: 'kind'    },
    ],
  },
  {
    id: 'napas_di', name: 'Napas Đi', storageTable: 'NAPAS',
    description: 'Giao dịch chuyển tiền đi qua kênh NAPAS',
    acceptedExtensions: ['.xlsx', '.xls'],
    fields: [
      { key: 'trace',  label: 'Số trace', alias: 'trace',  type: 'integer', required: true, allowedValues: [], storageCol: 'trace'  },
      { key: 'amount', label: 'Số tiền',  alias: 'amount', type: 'number',  required: true, allowedValues: [], storageCol: 'amount' },
      { key: 'ngay',   label: 'Ngày GD',  alias: 'ngay',   type: 'string',  required: true, allowedValues: [], storageCol: 'ngay'   },
    ],
  },
  {
    id: 'napas_den', name: 'Napas Đến', storageTable: 'NAPAS',
    description: 'Giao dịch chuyển tiền đến qua kênh NAPAS',
    acceptedExtensions: ['.xlsx', '.xls'],
    fields: [
      { key: 'trace',  label: 'Số trace', alias: 'trace',  type: 'integer', required: true, allowedValues: [], storageCol: 'trace'  },
      { key: 'amount', label: 'Số tiền',  alias: 'amount', type: 'number',  required: true, allowedValues: [], storageCol: 'amount' },
      { key: 'ngay',   label: 'Ngày GD',  alias: 'ngay',   type: 'string',  required: true, allowedValues: [], storageCol: 'ngay'   },
    ],
  },
  {
    id: 'napas_di_fail', name: 'Napas Đi Thất bại', storageTable: 'NAPAS',
    description: 'Giao dịch chuyển tiền đi thất bại (KTC)',
    acceptedExtensions: ['.xlsx'],
    fields: [
      { key: 'trace',  label: 'Số trace', alias: 'trace',  type: 'integer', required: true, allowedValues: [], storageCol: 'trace'  },
      { key: 'amount', label: 'Số tiền',  alias: 'amount', type: 'number',  required: true, allowedValues: [], storageCol: 'amount' },
    ],
  },
]

const DATA_TYPES = ['string', 'integer', 'number', 'date', 'boolean']

export default function FileTypeSettings() {
  const [fileTypes, setFileTypes]     = useState(DEFAULT_FILE_TYPES)
  const [expanded, setExpanded]       = useState(null)
  const [addFieldModal, setAddFieldModal] = useState(null)
  const [testModal, setTestModal]     = useState(null)
  const [newField, setNewField]       = useState({ label: '', alias: '', type: 'string', required: false, allowedValues: [], storageCol: '' })
  const [newAllowedVal, setNewAllowedVal] = useState('')
  const [extInputs, setExtInputs]     = useState({})

  const toggle = (id) => setExpanded(e => e === id ? null : id)

  const updateField = (ftId, fieldKey, patch) =>
    setFileTypes(prev => prev.map(ft =>
      ft.id !== ftId ? ft : { ...ft, fields: ft.fields.map(f => f.key !== fieldKey ? f : { ...f, ...patch }) }
    ))

  const removeField = (ftId, fieldKey) =>
    setFileTypes(prev => prev.map(ft =>
      ft.id !== ftId ? ft : { ...ft, fields: ft.fields.filter(f => f.key !== fieldKey) }
    ))

  const removeExtension = (ftId, idx) =>
    setFileTypes(prev => prev.map(ft =>
      ft.id !== ftId ? ft : { ...ft, acceptedExtensions: ft.acceptedExtensions.filter((_, i) => i !== idx) }
    ))

  const addExtension = (ftId) => {
    const raw = (extInputs[ftId] ?? '').trim()
    if (!raw) return
    const ext = raw.startsWith('.') ? raw : '.' + raw
    setFileTypes(prev => prev.map(ft =>
      ft.id !== ftId ? ft : { ...ft, acceptedExtensions: [...(ft.acceptedExtensions ?? []), ext] }
    ))
    setExtInputs(p => ({ ...p, [ftId]: '' }))
  }

  const saveNewField = () => {
    if (!newField.label || !addFieldModal) return
    const field = { ...newField, key: newField.alias || newField.label.toLowerCase().replace(/\s+/g, '_'), storageCol: newField.storageCol || newField.alias }
    setFileTypes(prev => prev.map(ft =>
      ft.id === addFieldModal ? { ...ft, fields: [...ft.fields, field] } : ft
    ))
    setAddFieldModal(null)
    setNewField({ label: '', alias: '', type: 'string', required: false, allowedValues: [], storageCol: '' })
  }

  return (
    <PageShell
      title="Cấu hình dạng file tải lên"
      subtitle="Định nghĩa loại file hệ thống chấp nhận, trường dữ liệu trích xuất và ánh xạ vào bảng lưu trữ."
      actions={<Button size="sm">+ Thêm loại file</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fileTypes.map(ft => (
          <FileTypeCard
            key={ft.id}
            ft={ft}
            expanded={expanded === ft.id}
            onToggle={() => toggle(ft.id)}
            onAddField={() => { setAddFieldModal(ft.id); setNewField(p => ({ ...p, storageCol: '' })) }}
            onRemoveField={(key) => removeField(ft.id, key)}
            onUpdateField={(fieldKey, patch) => updateField(ft.id, fieldKey, patch)}
            onTest={() => setTestModal(ft)}
            onRemoveExtension={(idx) => removeExtension(ft.id, idx)}
            extInput={extInputs[ft.id] ?? ''}
            onExtInputChange={(val) => setExtInputs(p => ({ ...p, [ft.id]: val }))}
            onAddExtension={() => addExtension(ft.id)}
          />
        ))}
      </div>

      <Modal open={!!addFieldModal} title="Thêm trường dữ liệu" onClose={() => setAddFieldModal(null)} onConfirm={saveNewField} confirmLabel="Thêm trường" width={500}>
        <FormRow label="Tên cột trong file (keyword nhận diện)">
          <Input placeholder="VD: TRACE NUMBER" value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} />
        </FormRow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormRow label="Alias trong hệ thống">
            <Input placeholder="VD: trace_number" value={newField.alias} onChange={e => setNewField(p => ({ ...p, alias: e.target.value }))} />
          </FormRow>
          <FormRow label="Cột bảng lưu trữ">
            <Input placeholder="VD: trace" value={newField.storageCol} onChange={e => setNewField(p => ({ ...p, storageCol: e.target.value }))} />
          </FormRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormRow label="Kiểu dữ liệu">
            <Select value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))}>
              {DATA_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </FormRow>
          <FormRow label=" ">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginTop: 6 }}>
              <input type="checkbox" checked={newField.required} onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))} style={{ accentColor: C.error, width: 14, height: 14 }} />
              Trường bắt buộc
            </label>
          </FormRow>
        </div>
        <FormRow label="Giá trị được phép (để trống = không giới hạn)">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Input placeholder="Nhập rồi Enter..." value={newAllowedVal} onChange={e => setNewAllowedVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newAllowedVal.trim()) { setNewField(p => ({ ...p, allowedValues: [...p.allowedValues, newAllowedVal.trim()] })); setNewAllowedVal('') } }} />
            <Button size="sm" variant="subtle" onClick={() => { if (newAllowedVal.trim()) { setNewField(p => ({ ...p, allowedValues: [...p.allowedValues, newAllowedVal.trim()] })); setNewAllowedVal('') } }}>Thêm</Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {newField.allowedValues.map((v, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: C.primaryLight, color: C.primary, border: `1px solid ${C.primaryBorder}`, borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                {v}
                <button onClick={() => setNewField(p => ({ ...p, allowedValues: p.allowedValues.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        </FormRow>
      </Modal>

      <TestUploadModal ft={testModal} onClose={() => setTestModal(null)} />
    </PageShell>
  )
}

function FileTypeCard({ ft, expanded, onToggle, onAddField, onRemoveField, onUpdateField, onTest, onRemoveExtension, extInput, onExtInputChange, onAddExtension }) {
  const color = TYPE_COLORS[ft.id] ?? C.primary
  const storageColor = { Swift: '#2563eb', Core: '#059669', NAPAS: '#d97706' }[ft.storageTable] ?? C.primary
  const exts = ft.acceptedExtensions ?? []

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderLeft: `4px solid ${color}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', borderBottom: expanded ? `1px solid ${C.cardBorder}` : 'none' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>{ft.name}</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{ft.description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant="neutral">{ft.fields.length} trường</Badge>
          <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: storageColor + '1a', color: storageColor, border: `1px solid ${storageColor}44` }}>→ {ft.storageTable}</span>
          {exts.map(ext => (
            <span key={ext} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: C.primaryLight, color: C.primary, border: `1px solid ${C.primaryBorder}` }}>{ext}</span>
          ))}
          <span style={{ color: C.textLight, fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          {/* Accepted extensions */}
          <SectionLabel>Định dạng file chấp nhận</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, alignItems: 'center' }}>
            {exts.map((ext, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: C.primaryLight, color: C.primary, border: `1px solid ${C.primaryBorder}`, borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                {ext}
                <button onClick={() => onRemoveExtension(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.primary, fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Input
                value={extInput}
                onChange={e => onExtInputChange(e.target.value)}
                placeholder=".csv"
                style={{ width: 80, fontSize: 12, padding: '3px 8px' }}
                onKeyDown={e => { if (e.key === 'Enter') onAddExtension() }}
              />
              <Button size="sm" variant="subtle" onClick={onAddExtension}>+ Thêm</Button>
            </div>
          </div>

          {/* Fields table */}
          <SectionLabel>Trường trích xuất & Giá trị được phép</SectionLabel>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: C.neutralBg }}>
                {['Tên cột trong file', 'Alias', 'Kiểu', 'Giá trị được phép', 'Bắt buộc', ''].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: C.textMuted, fontWeight: 700, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ft.fields.map(f => (
                <FieldRow key={f.key} f={f} onUpdate={patch => onUpdateField(f.key, patch)} onRemove={() => onRemoveField(f.key)} />
              ))}
            </tbody>
          </table>

          {/* Storage mapping */}
          <SectionLabel>Ánh xạ sang bảng lưu trữ ({ft.storageTable})</SectionLabel>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: storageColor + '0d' }}>
                {['Trường trích xuất (alias)', '', `Cột trong bảng ${ft.storageTable}`, 'Ghi chú'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, color: storageColor, fontWeight: 700, borderBottom: `1px solid ${storageColor}33`, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ft.fields.map(f => (
                <tr key={f.key} style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: C.primary }}>{f.alias}</td>
                  <td style={{ padding: '8px 12px', color: C.textLight, fontSize: 16, textAlign: 'center' }}>→</td>
                  <td style={{ padding: '8px 12px' }}>
                    <Input value={f.storageCol} onChange={e => onUpdateField(f.key, { storageCol: e.target.value })} style={{ fontFamily: 'monospace', fontSize: 12, padding: '4px 8px' }} />
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: C.textMuted }}>{f.type === 'date' ? 'Chuẩn hóa sang YYYYMMDD' : f.allowedValues.length ? `Enum: ${f.allowedValues.join(', ')}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="subtle" onClick={onAddField}>+ Thêm trường</Button>
            <Button size="sm" variant="ghost">Lưu thay đổi</Button>
            <Button size="sm" variant="ghost" onClick={onTest} style={{ marginLeft: 'auto', color: C.success, borderColor: C.successBorder, background: C.successBg }}>
              ▶ Kiểm tra trích xuất
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldRow({ f, onUpdate, onRemove }) {
  const [editingVals, setEditingVals] = useState(false)
  const [newVal, setNewVal] = useState('')
  const typeColor = { integer: C.primary, number: '#7c3aed', date: C.warning, boolean: '#059669', string: C.textMuted }

  return (
    <tr style={{ borderBottom: `1px solid ${C.cardBorder}` }}>
      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{f.label}</td>
      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: C.primary }}>{f.alias}</td>
      <td style={{ padding: '8px 12px' }}>
        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: (typeColor[f.type] ?? C.textMuted) + '18', color: typeColor[f.type] ?? C.textMuted, border: `1px solid ${(typeColor[f.type] ?? C.textMuted)}33` }}>
          {f.type}
        </span>
      </td>
      <td style={{ padding: '8px 12px', minWidth: 200 }}>
        {f.allowedValues.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {f.allowedValues.map((v, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 12, fontSize: 11, fontWeight: 500 }}>
                {v}
                <button onClick={() => onUpdate({ allowedValues: f.allowedValues.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
            <button onClick={() => setEditingVals(e => !e)} style={{ background: 'none', border: `1px dashed #059669`, cursor: 'pointer', color: '#059669', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>+</button>
          </div>
        ) : (
          <button onClick={() => setEditingVals(e => !e)} style={{ background: 'none', border: `1px dashed ${C.neutralBorder}`, cursor: 'pointer', color: C.textLight, borderRadius: 10, padding: '2px 10px', fontSize: 11 }}>
            Không giới hạn – nhấn để thêm
          </button>
        )}
        {editingVals && (
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <Input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="Giá trị mới..." style={{ fontSize: 12, padding: '4px 8px' }}
              onKeyDown={e => { if (e.key === 'Enter' && newVal.trim()) { onUpdate({ allowedValues: [...f.allowedValues, newVal.trim()] }); setNewVal(''); setEditingVals(false) } }} />
            <Button size="sm" variant="subtle" onClick={() => { if (newVal.trim()) { onUpdate({ allowedValues: [...f.allowedValues, newVal.trim()] }); setNewVal(''); setEditingVals(false) } }}>OK</Button>
          </div>
        )}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.required} onChange={e => onUpdate({ required: e.target.checked })} style={{ accentColor: C.error, width: 13, height: 13 }} />
          {f.required ? <Badge variant="error">Bắt buộc</Badge> : <span style={{ fontSize: 11, color: C.textLight }}>Tùy chọn</span>}
        </label>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 16, lineHeight: 1 }}>×</button>
      </td>
    </tr>
  )
}

function TestUploadModal({ ft, onClose }) {
  const [file, setFile]       = useState(null)
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)

  const MOCK_PREVIEW = [
    { seq: 1001, trace: 700112345, hostdate: 20260201, amount: 5000000,  status: 'THANH CONG' },
    { seq: 1002, trace: 700112346, hostdate: 20260201, amount: 12000000, status: 'THANH CONG' },
    { seq: 1003, trace: 700112347, hostdate: 20260202, amount: 3500000,  status: 'TIMEOUT'    },
    { seq: null, trace: 700112348, hostdate: 20260201, amount: 8000000,  status: 'BAD_STATUS' },
  ]

  const runTest = () => {
    if (!file) return
    setLoading(true)
    setTimeout(() => {
      setResult({
        totalRows: 2685, validRows: 2684,
        errors: [
          { row: 4, field: 'status', value: 'BAD_STATUS', reason: 'Không nằm trong giá trị được phép: THANH CONG, TIMEOUT, THAT BAI' },
          { row: 4, field: 'seq',    value: null,          reason: 'Trường bắt buộc bị thiếu giá trị' },
        ],
        preview: MOCK_PREVIEW,
      })
      setLoading(false)
    }, 900)
  }

  if (!ft) return null
  const color = TYPE_COLORS[ft.id] ?? C.primary

  return (
    <Modal open={!!ft} title={`Kiểm tra trích xuất – ${ft.name}`} onClose={onClose} width={680} onConfirm={null}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>Tải file mẫu lên để kiểm tra</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="file" accept={(ft.acceptedExtensions ?? ['.xlsx','.xls']).join(',')} onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
            style={{ flex: 1, padding: '6px', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md, fontSize: 13 }} />
          <Button onClick={runTest} disabled={!file || loading} variant="primary" style={{ background: color, borderColor: color }}>
            {loading ? 'Đang trích xuất...' : '▶ Chạy kiểm tra'}
          </Button>
        </div>
      </div>

      {result && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <StatBox label="Tổng dòng" val={result.totalRows.toLocaleString()} color={C.primary} />
            <StatBox label="Hợp lệ"    val={result.validRows.toLocaleString()} color={C.success} />
            <StatBox label="Lỗi"       val={result.errors.length}              color={result.errors.length ? C.error : C.success} />
          </div>

          {result.errors.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.error, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Lỗi validation</div>
              {result.errors.map((e, i) => (
                <div key={i} style={{ padding: '7px 12px', background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 6, fontSize: 12, marginBottom: 6, color: C.error }}>
                  <b>Dòng {e.row} · {e.field}</b>: giá trị <code style={{ background: '#fee2e2', padding: '0 4px', borderRadius: 3 }}>{String(e.value)}</code> — {e.reason}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Xem trước (5 dòng đầu)</div>
          <div style={{ overflowX: 'auto', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{ft.fields.map(f => <th key={f.key} style={{ padding: '7px 10px', background: color + '18', color, fontWeight: 700, textAlign: 'left', borderBottom: `1px solid ${C.cardBorder}`, whiteSpace: 'nowrap' }}>{f.alias}</th>)}</tr>
              </thead>
              <tbody>
                {result.preview.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 ? C.neutralBg : '#fff', borderBottom: `1px solid ${C.cardBorder}` }}>
                    {ft.fields.map(f => {
                      const val = row[f.alias] ?? row[f.key]
                      const invalid = f.allowedValues.length > 0 && val && !f.allowedValues.includes(String(val))
                      return <td key={f.key} style={{ padding: '6px 10px', fontFamily: 'monospace', color: invalid ? C.error : C.text, background: invalid ? C.errorBg : 'transparent' }}>{val ?? <span style={{ color: C.textLight }}>—</span>}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}

function StatBox({ label, val, color }) {
  return (
    <div style={{ flex: 1, padding: '10px 14px', background: color + '12', border: `1px solid ${color}33`, borderRadius: radius.md, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>{children}</div>
}
