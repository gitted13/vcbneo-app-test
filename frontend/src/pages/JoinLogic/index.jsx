import { useState, useEffect } from 'react'
import PageShell from '../../components/PageShell'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { Input, Select, FormRow } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'

// DB item → local shape
const toLocal = (item) => ({ id: item.id, ...item.config, lastRun: item.created, status: 'success' })
// local shape → config object sent to API
const toConfig = ({ name, leftSource, rightSource, direction, joinType, matchFields }) =>
  ({ name, leftSource, rightSource, direction, joinType, matchFields })

/*
 * Mỗi rule so khớp được định nghĩa ở cấp nguồn (Swift / Core / NAPAS),
 * không phải subtable. Backend tự map sang bảng cụ thể dựa vào direction:
 *   Swift + Đi   → swift_di       Swift + Đến  → swift_den
 *   NAPAS + Đi   → napas_di       NAPAS + Đến  → napas_den
 *   Core  + Đi   → core_ghino     Core  + Đến  → core_ghico
 */

const SOURCES = ['Swift', 'Core', 'NAPAS']

const DIRECTION_OPTIONS = [
  { value: 'Đi',    label: 'Đi' },
  { value: 'Đến',   label: 'Đến' },
  { value: 'Cả hai', label: 'Cả hai (Đi + Đến)' },
]

const JOIN_TYPES = [
  { value: 'left',  label: 'Left Join – giữ tất cả bảng trái' },
  { value: 'inner', label: 'Inner Join – chỉ dòng khớp' },
  { value: 'full',  label: 'Full Outer Join' },
]

const DIRECTION_COLOR = { 'Đi': '#2563eb', 'Đến': '#7c3aed', 'Cả hai': '#059669' }
const DIRECTION_BG    = { 'Đi': '#eff6ff', 'Đến': '#f5f3ff', 'Cả hai': '#f0fdf4' }

const INITIAL_LOGICS = [
  {
    id: 'jl_001', name: 'Swift vs NAPAS',
    leftSource: 'Swift', rightSource: 'NAPAS', direction: 'Đi', joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }, { left: 'amount', right: 'amount' }],
    lastRun: '2026-02-05 09:00', status: 'success',
  },
  {
    id: 'jl_002', name: 'Swift vs NAPAS',
    leftSource: 'Swift', rightSource: 'NAPAS', direction: 'Đến', joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }, { left: 'amount', right: 'amount' }],
    lastRun: '2026-02-05 09:01', status: 'success',
  },
  {
    id: 'jl_003', name: 'Swift vs Core',
    leftSource: 'Swift', rightSource: 'Core', direction: 'Đi', joinType: 'left',
    matchFields: [{ left: 'sequence', right: 'seq' }, { left: 'amount', right: 'amount' }],
    lastRun: null, status: 'idle',
  },
  {
    id: 'jl_004', name: 'Swift vs Core',
    leftSource: 'Swift', rightSource: 'Core', direction: 'Đến', joinType: 'left',
    matchFields: [{ left: 'sequence', right: 'seq' }, { left: 'amount', right: 'amount' }],
    lastRun: null, status: 'idle',
  },
  {
    id: 'jl_005', name: 'Core vs NAPAS',
    leftSource: 'Core', rightSource: 'NAPAS', direction: 'Đi', joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }, { left: 'amount', right: 'amount' }],
    lastRun: null, status: 'idle',
  },
  {
    id: 'jl_006', name: 'Core vs NAPAS',
    leftSource: 'Core', rightSource: 'NAPAS', direction: 'Đến', joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }, { left: 'amount', right: 'amount' }],
    lastRun: null, status: 'idle',
  },
]

const FIELD_LABEL = { trace: 'Số trace', amount: 'Số tiền', sequence: 'Số sequence', seq: 'Số sequence' }

/* ── Pair groups for display ─────────────────────────────────────────────────── */
const PAIR_META = {
  'Swift|NAPAS': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'NAPAS|Swift': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  'Swift|Core':  { color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  'Core|Swift':  { color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  'Core|NAPAS':  { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  'NAPAS|Core':  { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
}

function pairKey(item) { return `${item.leftSource}|${item.rightSource}` }
function pairMeta(item) { return PAIR_META[pairKey(item)] ?? { color: C.primary, bg: C.neutralBg, border: C.cardBorder } }

/* ── Main page ───────────────────────────────────────────────────────────────── */
export default function JoinLogic() {
  const { showConfirm, toast } = useApp()
  const { user }               = useAuth()
  const isAdmin  = user?.role === 'Admin'
  const isViewer = user?.role === 'Viewer'

  const [logics, setLogics]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing]   = useState(null)

  useEffect(() => {
    api.reconcileConfig.getJoinConfigs()
      .then(items => setLogics(items.map(toLocal)))
      .catch(() => toast('Không thể tải cấu hình đối chiếu.', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit   = (item) => { setEditing(item); setFormOpen(true) }

  const deleteItem = (item) => showConfirm({
    title: `Xóa rule "${item.name} – ${item.direction}"?`,
    message: 'Thao tác này sẽ xóa cấu hình so khớp. Không thể hoàn tác.',
    variant: 'danger',
    confirmLabel: 'Xóa',
    onConfirm: () => {
      api.reconcileConfig.deleteJoinConfig(item.id)
        .then(() => {
          setLogics(prev => prev.filter(l => l.id !== item.id))
          toast(`Đã xóa rule "${item.name} – ${item.direction}".`, 'success')
        })
        .catch(() => toast('Xóa thất bại.', 'error'))
    },
  })

  return (
    <PageShell
      title="Cấu hình đối chiếu"
      subtitle="Định nghĩa trường so khớp giữa 3 cặp nguồn dữ liệu (Swift / Core / NAPAS). Chiều GD và trường ghép là điều kiện của từng rule."
      actions={isAdmin ? <Button size="sm" onClick={openCreate}>+ Tạo rule mới</Button> : null}
    >
      {loading
        ? <div style={{ padding: '60px 0', textAlign: 'center', color: C.textMuted }}>Đang tải...</div>
        : logics.length === 0
        ? <EmptyState icon="🔗" title="Chưa có rule nào" description="Tạo rule so khớp đầu tiên." action={isAdmin ? '+ Tạo rule mới' : undefined} onAction={isAdmin ? openCreate : undefined} />
        : (
          <>
            <div style={{ padding: '10px 16px', marginBottom: 12, background: '#f8fafc', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md, fontSize: 13, color: C.textMuted }}>
              Mỗi rule định nghĩa cách ghép 2 nguồn theo chiều giao dịch và các trường chỉ định. Quy tắc thời gian cấu hình tại trang <b>Quy tắc thời gian</b>.
            </div>

            {/* Direction → Core entry mapping */}
            <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: radius.md }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Chiều GD → Loại ghi Core</div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>GD Đi</span>
                  <span style={{ color: '#6b7280', fontSize: 13 }}>→</span>
                  <span style={{ padding: '4px 12px', borderRadius: 6, background: '#dcfce7', border: '1px solid #86efac', fontSize: 12, fontWeight: 700, color: '#166534' }}>Core Ghi có</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>(Swift Đi / NAPAS Đi)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 6, background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>GD Đến</span>
                  <span style={{ color: '#6b7280', fontSize: 13 }}>→</span>
                  <span style={{ padding: '4px 12px', borderRadius: 6, background: '#dbeafe', border: '1px solid #93c5fd', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>Core Ghi nợ</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>(Swift Đến / NAPAS Đến)</span>
                </div>
              </div>
            </div>

            {/* Group by pair */}
            {groupByPair(logics).map(({ pairLabel, meta, items }) => (
              <div key={pairLabel} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{pairLabel}</span>
                  <div style={{ flex: 1, height: 1, background: meta.border }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(item => (
                    <LogicCard
                      key={item.id}
                      item={item}
                      meta={meta}
                      isAdmin={isAdmin}
                      isViewer={isViewer}
                      onEdit={() => openEdit(item)}
                      onDelete={() => deleteItem(item)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )
      }

      {isAdmin && (
        <LogicFormModal
          open={formOpen}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSave={(data) => {
            const config = toConfig(data)
            if (editing) {
              api.reconcileConfig.updateJoinConfig(editing.id, config)
                .then(() => {
                  setLogics(prev => prev.map(l => l.id === editing.id ? { ...l, ...data } : l))
                  toast('Đã lưu thay đổi.', 'success')
                  setFormOpen(false)
                })
                .catch(() => toast('Lưu thất bại.', 'error'))
            } else {
              api.reconcileConfig.createJoinConfig(config)
                .then(res => {
                  setLogics(prev => [...prev, toLocal({ id: res.id, config, created: new Date().toISOString() })])
                  toast('Đã tạo rule so khớp mới.', 'success')
                  setFormOpen(false)
                })
                .catch(() => toast('Tạo thất bại.', 'error'))
            }
          }}
        />
      )}
    </PageShell>
  )
}

function groupByPair(logics) {
  const groups = {}
  logics.forEach(item => {
    const key  = pairKey(item)
    const meta = pairMeta(item)
    const label = `${item.leftSource} ↔ ${item.rightSource}`
    if (!groups[key]) groups[key] = { pairLabel: label, meta, items: [] }
    groups[key].items.push(item)
  })
  return Object.values(groups)
}

/* ── Logic Card ──────────────────────────────────────────────────────────────── */
function LogicCard({ item, meta, isAdmin, isViewer, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const statusMap = {
    success: <Badge variant="success" dot>Đã cấu hình</Badge>,
    idle:    <Badge variant="neutral">Chưa kích hoạt</Badge>,
  }

  const dirColor = DIRECTION_COLOR[item.direction] ?? C.primary
  const dirBg    = DIRECTION_BG[item.direction]    ?? C.neutralBg

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>

        {/* Direction badge */}
        <div style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 20, background: dirBg, border: `1px solid ${dirColor}22`, fontSize: 12, fontWeight: 700, color: dirColor, minWidth: 52, textAlign: 'center' }}>
          {item.direction}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {statusMap[item.status] ?? statusMap.idle}
            <span style={{ fontSize: 12, color: C.textMuted }}>
              Khớp theo: <b style={{ color: C.text }}>{item.matchFields.map(f => `${FIELD_LABEL[f.left] ?? f.left} = ${FIELD_LABEL[f.right] ?? f.right}`).join(' · ')}</b>
            </span>
            {item.lastRun && <span style={{ fontSize: 12, color: C.textLight }}>· {item.lastRun}</span>}
          </div>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="ghost" onClick={onEdit}>Sửa</Button>
            <Button size="sm" variant="ghost" onClick={onDelete} style={{ color: C.error }}>Xóa</Button>
          </div>
        )}
        <span style={{ color: C.textLight, fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>›</span>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${C.cardBorder}`, padding: '14px 20px', background: C.neutralBg, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <DetailItem label="Nguồn trái"  val={<b style={{ color: meta.color }}>{item.leftSource}</b>} />
          <DetailItem label="Nguồn phải"  val={<b style={{ color: meta.color }}>{item.rightSource}</b>} />
          <DetailItem label="Kiểu join"   val={JOIN_TYPES.find(j => j.value === item.joinType)?.label ?? item.joinType} />
          <DetailItem
            label="Trường so khớp"
            val={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                {item.matchFields.map((f, i) => (
                  <span key={i} style={{ fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '3px 8px', borderRadius: 4, display: 'inline-block' }}>
                    {FIELD_LABEL[f.left] ?? f.left} = {FIELD_LABEL[f.right] ?? f.right}
                  </span>
                ))}
              </div>
            }
          />
          <DetailItem label="Chiều GD"    val={<span style={{ color: dirColor, fontWeight: 700 }}>{item.direction}</span>} />
          {item.lastRun && <DetailItem label="Chạy lần cuối" val={item.lastRun} />}
        </div>
      )}
    </div>
  )
}

/* ── Form Modal ──────────────────────────────────────────────────────────────── */
function LogicFormModal({ open, editing, onClose, onSave }) {
  const blank = {
    name: '', leftSource: 'Swift', rightSource: 'NAPAS',
    direction: 'Đi', joinType: 'left',
    matchFields: [{ left: 'trace', right: 'trace' }, { left: 'amount', right: 'amount' }],
  }
  const [form, setForm] = useState(() => editing ?? blank)
  useState(() => { if (open) setForm(editing ?? blank) })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const autoName = `${form.leftSource} vs ${form.rightSource}`

  return (
    <Modal open={open} title={editing ? 'Sửa rule so khớp' : 'Tạo rule so khớp mới'} onClose={onClose} onConfirm={() => onSave({ ...form, name: form.name || autoName })} width={580}>
      <FormRow label="Tên rule" hint="Để trống sẽ tự động đặt tên">
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder={autoName} />
      </FormRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'end' }}>
        <FormRow label="Nguồn trái">
          <Select value={form.leftSource} onChange={e => set('leftSource', e.target.value)}>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </FormRow>
        <div style={{ paddingBottom: 8, color: C.textMuted, fontWeight: 700, fontSize: 16 }}>↔</div>
        <FormRow label="Nguồn phải">
          <Select value={form.rightSource} onChange={e => set('rightSource', e.target.value)}>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </FormRow>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormRow label="Chiều GD">
          <Select value={form.direction} onChange={e => set('direction', e.target.value)}>
            {DIRECTION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </Select>
        </FormRow>
        <FormRow label="Kiểu join">
          <Select value={form.joinType} onChange={e => set('joinType', e.target.value)}>
            {JOIN_TYPES.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
          </Select>
        </FormRow>
      </div>

      <FormRow label="Trường so khớp (trái = phải)" hint="Các cặp trường dùng để ghép giữa 2 nguồn">
        {form.matchFields.map((mf, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Input
              value={mf.left}
              onChange={e => set('matchFields', form.matchFields.map((f,j) => j===i ? {...f, left: e.target.value} : f))}
              placeholder={`Trường ${form.leftSource}`}
            />
            <span style={{ color: C.textMuted, flexShrink: 0, fontWeight: 700 }}>=</span>
            <Input
              value={mf.right}
              onChange={e => set('matchFields', form.matchFields.map((f,j) => j===i ? {...f, right: e.target.value} : f))}
              placeholder={`Trường ${form.rightSource}`}
            />
            <button onClick={() => set('matchFields', form.matchFields.filter((_,j) => j!==i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 18 }}>×</button>
          </div>
        ))}
        <button onClick={() => set('matchFields', [...form.matchFields, { left: '', right: '' }])} style={{ background: 'none', border: `1px dashed ${C.primary}`, cursor: 'pointer', color: C.primary, borderRadius: 6, padding: '4px 12px', fontSize: 12 }}>+ Thêm cặp trường</button>
      </FormRow>

      {/* Preview */}
      <div style={{ marginTop: 4, padding: '10px 14px', background: C.neutralBg, borderRadius: radius.md, fontSize: 12, color: C.textMuted }}>
        Backend sẽ map: <b style={{ color: C.text }}>{form.leftSource}</b> {form.direction !== 'Cả hai' && `(${form.direction})`} ↔ <b style={{ color: C.text }}>{form.rightSource}</b> {form.direction !== 'Cả hai' && `(${form.direction})`}
      </div>
    </Modal>
  )
}

function DetailItem({ label, val }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text }}>{val}</div>
    </div>
  )
}

