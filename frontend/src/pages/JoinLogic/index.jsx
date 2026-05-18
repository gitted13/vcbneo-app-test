import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { Input, Select, FormRow } from '../../components/Input'
import { C, radius, shadow } from '../../theme'

const INITIAL_LOGICS = [
  {
    id: 'jl_001',
    name: 'Swift Đi vs Napas Đi',
    leftTable: 'swift_di', rightTable: 'napas_di',
    direction: 'forward',
    joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }, { left: 'amount', right: 'amount' }],
    dateOffset: 'T_to_T1',
    groupBy: 'date_status',
    resultTable: 'result_di',
    lastRun: '2026-02-05 09:00',
    lastResult: { matched: 2664, onlyLeft: 24, onlyRight: 34 },
    status: 'success',
  },
  {
    id: 'jl_002',
    name: 'Swift Đến vs Napas Đến',
    leftTable: 'swift_den', rightTable: 'napas_den',
    direction: 'backward',
    joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }, { left: 'amount', right: 'amount' }],
    dateOffset: 'T_to_T1',
    groupBy: 'date_status',
    resultTable: 'result_den',
    lastRun: '2026-02-05 09:01',
    lastResult: { matched: 2237, onlyLeft: 31, onlyRight: 29 },
    status: 'success',
  },
  {
    id: 'jl_003',
    name: 'Swift Đi vs Core (Ghi có)',
    leftTable: 'swift_di', rightTable: 'core',
    direction: 'forward',
    joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }],
    dateOffset: 'same',
    groupBy: 'date_status',
    resultTable: 'result_di_core',
    lastRun: null,
    lastResult: null,
    status: 'idle',
  },
]

/* mock result rows keyed by logic id + tab */
const MOCK_RESULT = {
  jl_001: {
    matched: [
      { trace: '700112345', swift_date: '20260201', napas_date: '20260131', swift_amount: 5000000, napas_amount: 5000000,  match: 'KHOP' },
      { trace: '700112346', swift_date: '20260201', napas_date: '20260131', swift_amount: 12000000, napas_amount: 12000000, match: 'KHOP' },
      { trace: '700112349', swift_date: '20260202', napas_date: '20260201', swift_amount: 2100000, napas_amount: 2100000,  match: 'KHOP' },
    ],
    onlyLeft: [
      { trace: '700112347', swift_date: '20260202', swift_amount: 3500000, status: 'TIMEOUT', ly_do: 'Không có trên Napas' },
      { trace: '700112348', swift_date: '20260201', swift_amount: 8000000, status: 'THAT BAI', ly_do: 'Không có trên Napas' },
    ],
    onlyRight: [
      { trace: '700199001', napas_date: '20260131', napas_amount: 4500000, ly_do: 'Không có trên Swift' },
      { trace: '700199002', napas_date: '20260131', napas_amount: 6700000, ly_do: 'Không có trên Swift' },
    ],
  },
  jl_002: {
    matched: [
      { trace: '700212345', swift_date: '20260201', napas_date: '20260131', swift_amount: 3200000, napas_amount: 3200000, match: 'KHOP' },
      { trace: '700212346', swift_date: '20260201', napas_date: '20260131', swift_amount: 9100000, napas_amount: 9100000, match: 'KHOP' },
    ],
    onlyLeft: [
      { trace: '700212347', swift_date: '20260202', swift_amount: 7700000, status: 'TIMEOUT', ly_do: 'Không có trên Napas' },
    ],
    onlyRight: [
      { trace: '700299001', napas_date: '20260131', napas_amount: 2200000, ly_do: 'Không có trên Swift' },
    ],
  },
}

const RESULT_COLS = {
  matched:   ['trace', 'swift_date', 'napas_date', 'swift_amount', 'napas_amount', 'match'],
  onlyLeft:  ['trace', 'swift_date', 'swift_amount', 'status', 'ly_do'],
  onlyRight: ['trace', 'napas_date', 'napas_amount', 'ly_do'],
}

const DATE_OFFSETS = [
  { value: 'same',     label: 'T → T (cùng ngày)' },
  { value: 'T_to_T1',  label: 'T → T+1 (file T, Napas T+1)' },
  { value: 'Tm1_to_T', label: 'T-1 → T (file T-1, Napas T)' },
]

const JOIN_TYPES = [
  { value: 'left',  label: 'Left Join – giữ tất cả bảng trái' },
  { value: 'inner', label: 'Inner Join – chỉ dòng khớp' },
  { value: 'full',  label: 'Full Outer Join' },
]

const TABLES = ['swift_di', 'swift_den', 'core', 'napas_di', 'napas_den', 'napas_di_fail']

export default function JoinLogic() {
  const [logics, setLogics] = useState(INITIAL_LOGICS)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState(null)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit   = (item) => { setEditing(item); setFormOpen(true) }
  const deleteItem = (id) => setLogics(prev => prev.filter(l => l.id !== id))

  return (
    <PageShell
      title="Logic đối soát"
      subtitle="Định nghĩa quy tắc ghép bảng để so sánh dữ liệu giữa các nguồn. Mỗi logic cho ra một bảng kết quả có thể xem trực tiếp."
      actions={<Button onClick={openCreate}>+ Tạo logic mới</Button>}
    >
      {logics.length === 0
        ? <EmptyState icon="🔗" title="Chưa có logic nào" description="Tạo logic đối soát đầu tiên để bắt đầu so sánh dữ liệu giữa các bảng." action="+ Tạo logic mới" onAction={openCreate} />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {logics.map(item => (
              <LogicCard key={item.id} item={item} onEdit={() => openEdit(item)} onDelete={() => deleteItem(item.id)} />
            ))}
          </div>
      }

      <LogicFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) setLogics(prev => prev.map(l => l.id === editing.id ? { ...l, ...data } : l))
          else setLogics(prev => [...prev, { ...data, id: 'jl_' + Date.now(), lastRun: null, lastResult: null, status: 'idle' }])
          setFormOpen(false)
        }}
      />
    </PageShell>
  )
}

function LogicCard({ item, onEdit, onDelete }) {
  const [expanded, setExpanded]     = useState(false)
  const [resultTab, setResultTab]   = useState('matched')

  const statusMap = {
    success: <Badge variant="success" dot>Đã chạy</Badge>,
    idle:    <Badge variant="neutral">Chưa chạy</Badge>,
    running: <Badge variant="warning" dot>Đang chạy</Badge>,
  }

  const resultData = MOCK_RESULT[item.id]
  const resultRows = resultData?.[resultTab] ?? []
  const resultCols = RESULT_COLS[resultTab] ?? []

  const RESULT_TABS = [
    { key: 'matched',   label: 'Khớp',         count: item.lastResult?.matched,    color: C.success },
    { key: 'onlyLeft',  label: 'Chỉ bên trái', count: item.lastResult?.onlyLeft,   color: C.warning },
    { key: 'onlyRight', label: 'Chỉ bên phải', count: item.lastResult?.onlyRight,  color: C.error   },
  ]

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{item.name}</span>
            {statusMap[item.status]}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', gap: 16 }}>
            <span><b style={{ color: C.primary }}>{item.leftTable}</b> → <b style={{ color: C.primary }}>{item.rightTable}</b></span>
            <span>Ghép theo: {item.matchFields.map(f => f.left).join(', ')}</span>
            {item.lastRun && <span>Chạy lần cuối: {item.lastRun}</span>}
          </div>
        </div>

        {item.lastResult && (
          <div style={{ display: 'flex', gap: 16, fontSize: 13, marginRight: 8 }}>
            <StatPill label="Khớp"         val={item.lastResult.matched}    color={C.success} />
            <StatPill label="Chỉ bên trái" val={item.lastResult.onlyLeft}   color={C.warning} />
            <StatPill label="Chỉ bên phải" val={item.lastResult.onlyRight}  color={C.error}   />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="primary">Chạy</Button>
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onEdit() }}>Sửa</Button>
          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); onDelete() }} style={{ color: C.error }}>Xóa</Button>
        </div>
        <span style={{ color: C.textLight, fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${C.cardBorder}` }}>
          {/* Config detail */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '16px 20px', background: C.neutralBg, fontSize: 13 }}>
            <DetailItem label="Loại join"       val={JOIN_TYPES.find(j => j.value === item.joinType)?.label} />
            <DetailItem label="Offset ngày"     val={DATE_OFFSETS.find(d => d.value === item.dateOffset)?.label} />
            <DetailItem label="Nhóm theo"       val={item.groupBy} />
            <DetailItem label="Bảng kết quả"    val={<span style={{ fontFamily: 'monospace', color: C.primary }}>{item.resultTable}</span>} />
            <DetailItem label="Chiều giao dịch" val={item.direction === 'forward' ? 'Đi (Forward)' : 'Đến (Backward)'} />
            <DetailItem label="Trường ghép"     val={item.matchFields.map(f => `${f.left} = ${f.right}`).join(' & ')} />
          </div>

          {/* Inline result table – only when logic has been run */}
          {resultData && (
            <div style={{ borderTop: `1px solid ${C.cardBorder}` }}>
              {/* Result tab bar */}
              <div style={{ display: 'flex', gap: 0, background: '#fff', borderBottom: `1px solid ${C.cardBorder}` }}>
                {RESULT_TABS.map(t => {
                  const active = t.key === resultTab
                  return (
                    <button
                      key={t.key}
                      onClick={() => setResultTab(t.key)}
                      style={{
                        padding: '10px 20px', border: 'none', cursor: 'pointer',
                        background: active ? '#fff' : C.neutralBg,
                        borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent',
                        fontSize: 12, fontWeight: active ? 700 : 500,
                        color: active ? t.color : C.textMuted,
                        transition: 'all 0.12s',
                      }}
                    >
                      {t.label}
                      {t.count != null && (
                        <span style={{
                          marginLeft: 6,
                          padding: '1px 7px', borderRadius: 10,
                          fontSize: 11, fontWeight: 700,
                          background: active ? t.color : C.cardBorder,
                          color: active ? '#fff' : C.textMuted,
                        }}>
                          {t.count.toLocaleString()}
                        </span>
                      )}
                    </button>
                  )
                })}
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
                  <Button size="sm" variant="ghost" style={{ fontSize: 11 }}>Xuất CSV</Button>
                </div>
              </div>

              {/* Result rows */}
              <div style={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      {resultCols.map(c => (
                        <th key={c} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                          {c.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 ? C.neutralBg : '#fff' }}>
                        {resultCols.map(c => (
                          <td key={c} style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                            {c === 'match' ? <Badge variant="success">Khớp</Badge>
                              : c === 'status' ? (
                                row[c] === 'TIMEOUT' ? <Badge variant="warning" dot>Timeout</Badge>
                                : row[c] === 'THAT BAI' ? <Badge variant="error" dot>Thất bại</Badge>
                                : <span style={{ color: C.textMuted }}>{row[c]}</span>
                              )
                              : c.includes('amount') ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{Number(row[c]).toLocaleString('vi-VN')} ₫</span>
                              : c === 'ly_do' ? <span style={{ color: resultTab === 'matched' ? C.text : C.error, fontSize: 11 }}>{row[c]}</span>
                              : <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.text }}>{row[c]}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '8px 14px', fontSize: 11, color: C.textMuted, borderTop: `1px solid ${C.cardBorder}` }}>
                Hiển thị {resultRows.length} dòng mẫu · Bảng đầy đủ: <span style={{ fontFamily: 'monospace', color: C.primary }}>{item.resultTable}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatPill({ label, val, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{val?.toLocaleString()}</div>
      <div style={{ fontSize: 10, color: C.textMuted }}>{label}</div>
    </div>
  )
}

function DetailItem({ label, val }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text }}>{val}</div>
    </div>
  )
}

function LogicFormModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(editing ?? {
    name: '', leftTable: 'swift_di', rightTable: 'napas_di',
    direction: 'forward', joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }, { left: 'amount', right: 'amount' }],
    dateOffset: 'T_to_T1', groupBy: 'date_status', resultTable: '',
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open={open} title={editing ? 'Sửa logic đối soát' : 'Tạo logic đối soát mới'} onClose={onClose} onConfirm={() => onSave(form)} width={600}>
      <FormRow label="Tên logic">
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="VD: Swift Đi vs Napas Đi" />
      </FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormRow label="Bảng trái (nguồn)">
          <Select value={form.leftTable} onChange={e => set('leftTable', e.target.value)}>
            {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormRow>
        <FormRow label="Bảng phải (đích)">
          <Select value={form.rightTable} onChange={e => set('rightTable', e.target.value)}>
            {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </FormRow>
        <FormRow label="Kiểu join">
          <Select value={form.joinType} onChange={e => set('joinType', e.target.value)}>
            {JOIN_TYPES.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
          </Select>
        </FormRow>
        <FormRow label="Offset ngày">
          <Select value={form.dateOffset} onChange={e => set('dateOffset', e.target.value)}>
            {DATE_OFFSETS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        </FormRow>
      </div>
      <FormRow label="Trường ghép (left = right)" hint="Các cặp trường dùng để so khớp giữa 2 bảng">
        {form.matchFields.map((mf, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Input value={mf.left}  onChange={e => set('matchFields', form.matchFields.map((f,j) => j===i ? {...f, left: e.target.value} : f))} placeholder="Trường bảng trái" />
            <span style={{ color: C.textMuted, flexShrink: 0 }}>=</span>
            <Input value={mf.right} onChange={e => set('matchFields', form.matchFields.map((f,j) => j===i ? {...f, right: e.target.value} : f))} placeholder="Trường bảng phải" />
            <button onClick={() => set('matchFields', form.matchFields.filter((_,j) => j!==i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 18 }}>×</button>
          </div>
        ))}
        <button onClick={() => set('matchFields', [...form.matchFields, { left: '', right: '' }])} style={{ background: 'none', border: `1px dashed ${C.primary}`, cursor: 'pointer', color: C.primary, borderRadius: 6, padding: '4px 12px', fontSize: 12 }}>+ Thêm cặp trường</button>
      </FormRow>
      <FormRow label="Tên bảng kết quả" hint="Dữ liệu sau khi ghép sẽ được lưu vào bảng này">
        <Input value={form.resultTable} onChange={e => set('resultTable', e.target.value)} placeholder="VD: result_di_vs_napas" />
      </FormRow>
    </Modal>
  )
}
