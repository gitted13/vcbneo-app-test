import { useState, useEffect } from 'react'
import PageShell from '../../components/PageShell'
import { C, radius, shadow } from '../../theme'
import { SWIFT_COLS_DI, SWIFT_COLS_DEN, NAPAS_COLS_DI, NAPAS_COLS_DEN, CORE_COLS_DI, CORE_COLS_DEN } from '../../data/reconcile'

const F = (f, op, v) => ({ f, op, v })

const DEFAULT_CONDS = {
  SWIFT_DI: [
    [F('TT Swift','=','Thành công'), F('Ngày GD','=','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Thành công'), F('Ngày GD','≠','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Timeout'),    F('Ngày GD','=','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Timeout'),    F('Ngày GD','≠','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Thất bại'),   F('Ngày GD','=','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Thất bại'),   F('Ngày GD','≠','Ngày GN'),  F('Core','≠','null')],
    [F('Swift','≠','null'),          F('Core','=','null')],
  ],
  SWIFT_DEN: [
    [F('TT Swift','=','Thành công'), F('Ngày GD','=','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Thành công'), F('Ngày GD','≠','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Timeout'),    F('Ngày GD','=','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Timeout'),    F('Ngày GD','≠','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Thất bại'),   F('Ngày GD','=','Ngày GN'),  F('Core','≠','null')],
    [F('TT Swift','=','Thất bại'),   F('Ngày GD','≠','Ngày GN'),  F('Core','≠','null')],
  ],
  NAPAS_DI: [
    [F('TC/KTC','=','TC'), F('Ngày NAPAS','<','Ngày Core'), F('Core','≠','null')],
    [F('TC/KTC','=','TC'), F('Ngày NAPAS','=','Ngày Core'), F('Core','≠','null')],
    [F('TC/KTC','=','KTC')],
    [F('TC/KTC','=','TC'), F('Core','=','null')],
  ],
  NAPAS_DEN: [
    [F('TC/KTC','=','TC'), F('Ngày Core','<','Ngày NAPAS'), F('Core','≠','null')],
    [F('TC/KTC','=','TC'), F('Ngày Core','=','Ngày NAPAS'), F('Core','≠','null')],
    [F('TC/KTC','=','TC'), F('Ngày Core','>','Ngày NAPAS'), F('Core','≠','null')],
  ],
  CORE_DI: [
    [F('Ngày Swift','<','Ngày Core'), F('Ngày NAPAS','=','Ngày Core'), F('Swift & NAPAS','≠','null')],
    [F('Ngày Swift','=','Ngày Core'), F('Ngày NAPAS','=','Ngày Core'), F('Swift & NAPAS','≠','null')],
    [F('Ngày Swift','=','Ngày Core'), F('Ngày NAPAS','>','Ngày Core'), F('Swift & NAPAS','≠','null')],
    [F('TT Swift','=','Thất bại'),    F('NAPAS','=','null'),           F('Core','≠','null')],
  ],
  CORE_DEN: [
    [F('Ngày NAPAS','<','Ngày Core'), F('NAPAS','≠','null')],
    [F('Ngày NAPAS','=','Ngày Core'), F('NAPAS','≠','null')],
    [F('Ngày NAPAS','>','Ngày Core'), F('NAPAS','≠','null')],
    [F('Core','≠','null'),            F('NAPAS','=','null')],
  ],
}

const OP_COLOR = {
  '=':  { color: '#166534', bg: '#dcfce7', border: '#86efac' },
  '≠':  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  '<':  { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  '>':  { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
}

const FIELD_OPTIONS = [
  'TT Swift', 'Ngày GD', 'Ngày GN', 'Swift',
  'TC/KTC', 'Ngày NAPAS', 'NAPAS',
  'Ngày Core', 'Core', 'Ngày Swift', 'Swift & NAPAS',
]

const VALUE_SUGGESTIONS = {
  'TT Swift':      ['Thành công', 'Timeout', 'Thất bại'],
  'Ngày GD':       ['Ngày GN'],
  'Ngày GN':       ['Ngày GD'],
  'TC/KTC':        ['TC', 'KTC'],
  'Ngày NAPAS':    ['Ngày Core'],
  'Ngày Swift':    ['Ngày Core'],
  'Ngày Core':     ['Ngày NAPAS', 'Ngày Swift'],
  'Core':          ['null'],
  'Swift':         ['null'],
  'NAPAS':         ['null'],
  'Swift & NAPAS': ['null'],
}

const LS_KEY = 'vcbneo_dateRulesConds_v2'

function loadConds() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_CONDS
}

function persistConds(c) {
  localStorage.setItem(LS_KEY, JSON.stringify(c))
}

/* ── Chip ─────────────────────────────────────────────────────────────────── */
function Chip({ chip, onRemove }) {
  const c = OP_COLOR[chip.op] ?? { color: '#374151', bg: '#f3f4f6', border: '#e5e7eb' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: onRemove ? '2px 4px 2px 7px' : '2px 7px',
      borderRadius: 5, border: `1px solid ${c.border}`,
      background: c.bg, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap',
    }}>
      <span style={{ color: C.textMuted, fontWeight: 400 }}>{chip.f}</span>
      <span style={{ color: c.color, fontWeight: 700, margin: '0 2px' }}>{chip.op}</span>
      <span style={{ color: c.color, fontWeight: 700 }}>{chip.v}</span>
      {onRemove && (
        <button onClick={onRemove} style={{
          marginLeft: 2, background: 'none', border: 'none', cursor: 'pointer',
          color: '#ef4444', fontSize: 14, fontWeight: 700, padding: '0 2px',
          lineHeight: 1, display: 'flex', alignItems: 'center',
        }}>×</button>
      )}
    </span>
  )
}

/* ── AddChipForm ──────────────────────────────────────────────────────────── */
function AddChipForm({ onAdd }) {
  const [f, setF] = useState(FIELD_OPTIONS[0])
  const [op, setOp] = useState('=')
  const [v, setV] = useState('')

  const suggestions = VALUE_SUGGESTIONS[f] ?? []
  const sel = { fontSize: 11, padding: '3px 6px', borderRadius: 4, border: `1px solid ${C.cardBorder}`, background: '#fff', fontFamily: 'monospace', cursor: 'pointer' }

  const handleAdd = () => {
    const val = v.trim()
    if (!val) return
    onAdd({ f, op, v: val })
    setV('')
  }

  return (
    <div style={{
      display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap',
      marginTop: 8, padding: '8px 10px',
      background: '#f8fafc', borderRadius: 6, border: '1px dashed #d1d5db',
    }}>
      <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0 }}>
        + Điều kiện:
      </span>
      <select value={f} onChange={e => { setF(e.target.value); setV('') }} style={sel}>
        {FIELD_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <select value={op} onChange={e => setOp(e.target.value)} style={{ ...sel, width: 48, textAlign: 'center' }}>
        {Object.keys(OP_COLOR).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {suggestions.length > 0 ? (
        <select value={v} onChange={e => setV(e.target.value)} style={{ ...sel, minWidth: 100 }}>
          <option value="">-- giá trị --</option>
          {suggestions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <input
          value={v} onChange={e => setV(e.target.value)}
          placeholder="nhập giá trị..."
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ ...sel, width: 110, cursor: 'text' }}
        />
      )}
      <button onClick={handleAdd} style={{
        fontSize: 11, padding: '3px 10px', borderRadius: 4,
        border: '1px solid #bfdbfe', background: '#eff6ff',
        color: '#1e40af', fontWeight: 700, cursor: 'pointer',
      }}>Thêm</button>
    </div>
  )
}

/* ── ColTable ─────────────────────────────────────────────────────────────── */
function ColTable({ cols, rowConds, condKey, onSaveRow }) {
  const [editingRow, setEditingRow] = useState(null)
  const [draft, setDraft]           = useState([])

  /* reset khi đổi tab */
  useEffect(() => { setEditingRow(null) }, [condKey])

  const startEdit = i => {
    setDraft(rowConds.map(r => [...r]))
    setEditingRow(i)
  }
  const cancel = () => setEditingRow(null)
  const save   = i => { onSaveRow(condKey, i, draft[i]); setEditingRow(null) }

  const removeChip = (ri, ci) =>
    setDraft(prev => prev.map((r, i) => i === ri ? r.filter((_, j) => j !== ci) : r))
  const addChip = (ri, chip) =>
    setDraft(prev => prev.map((r, i) => i === ri ? [...r, chip] : r))

  const th = { padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.cardBorder}` }

  return (
    <div style={{ border: `1px solid ${C.cardBorder}`, borderRadius: radius.md, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.neutralBg }}>
            <th style={{ ...th, width: '34%' }}>Trạng thái</th>
            <th style={{ ...th }}>Điều kiện dữ liệu</th>
            <th style={{ ...th, width: 52 }}></th>
          </tr>
        </thead>
        <tbody>
          {cols.map((col, i) => {
            const isEditing = editingRow === i
            const chips = isEditing ? (draft[i] ?? []) : (rowConds[i] ?? [])
            return (
              <tr key={i} style={{
                borderBottom: i < cols.length - 1 ? `1px solid ${C.cardBorder}` : 'none',
                background: isEditing ? '#fffbeb' : (i % 2 ? C.neutralBg : '#fff'),
              }}>
                <td style={{ padding: '10px 14px', verticalAlign: isEditing ? 'top' : 'middle' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 5,
                    fontSize: 12, fontWeight: 700,
                    background: col.bg, color: col.color, border: `1px solid ${col.border}`,
                  }}>
                    {col.label}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', verticalAlign: isEditing ? 'top' : 'middle' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {chips.map((chip, j) => (
                      <Chip key={j} chip={chip}
                        onRemove={isEditing ? () => removeChip(i, j) : undefined} />
                    ))}
                    {chips.length === 0 && !isEditing && (
                      <span style={{ fontSize: 11, color: '#d1d5db', fontStyle: 'italic' }}>Chưa có điều kiện</span>
                    )}
                  </div>
                  {isEditing && (
                    <>
                      <AddChipForm onAdd={chip => addChip(i, chip)} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button onClick={() => save(i)} style={{
                          fontSize: 11, padding: '4px 14px', borderRadius: 5,
                          border: '1px solid #86efac', background: '#dcfce7',
                          color: '#166534', fontWeight: 700, cursor: 'pointer',
                        }}>✓ Lưu</button>
                        <button onClick={cancel} style={{
                          fontSize: 11, padding: '4px 14px', borderRadius: 5,
                          border: `1px solid ${C.cardBorder}`, background: '#fff',
                          color: C.textMuted, cursor: 'pointer',
                        }}>Hủy</button>
                      </div>
                    </>
                  )}
                </td>
                <td style={{ padding: '10px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                  {!isEditing && editingRow === null && (
                    <button
                      onClick={() => startEdit(i)}
                      title="Chỉnh sửa điều kiện"
                      style={{
                        background: 'none', border: '1px solid #e5e7eb', borderRadius: 5,
                        cursor: 'pointer', padding: '4px 7px', fontSize: 13,
                        color: '#9ca3af', lineHeight: 1,
                      }}
                      onMouseEnter={e => Object.assign(e.currentTarget.style, { background: '#f3f4f6', color: '#374151' })}
                      onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'none', color: '#9ca3af' })}
                    >✎</button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Section config ───────────────────────────────────────────────────────── */
const SECTIONS = [
  {
    id: 'swift', title: 'Swift ↔ Core GL', accent: '#1e40af', accentBg: '#eff6ff', accentBorder: '#bfdbfe',
    note: 'T = txnDate (ngày GD thực tế của Swift). T+1 khi txnDate ≠ hostDate — Core ghi nhận vào ngày tiếp theo.',
    tabs: [
      { label: 'Chiều Đi',  count: SWIFT_COLS_DI.length,  cols: SWIFT_COLS_DI,  condKey: 'SWIFT_DI' },
      { label: 'Chiều Đến', count: SWIFT_COLS_DEN.length, cols: SWIFT_COLS_DEN, condKey: 'SWIFT_DEN' },
    ],
  },
  {
    id: 'napas', title: 'NAPAS ↔ Core GL', accent: '#854d0e', accentBg: '#fefce8', accentBorder: '#fde68a',
    note: 'NAPAS không có timeout — chỉ TC (failed = false) và KTC (failed = true). T = napas.date.',
    tabs: [
      { label: 'Chiều Đi',  count: NAPAS_COLS_DI.length,  cols: NAPAS_COLS_DI,  condKey: 'NAPAS_DI' },
      { label: 'Chiều Đến', count: NAPAS_COLS_DEN.length, cols: NAPAS_COLS_DEN, condKey: 'NAPAS_DEN' },
    ],
  },
  {
    id: 'core', title: 'Core GL ↔ Swift + NAPAS', accent: '#166534', accentBg: '#dcfce7', accentBorder: '#86efac',
    note: 'Core làm gốc (T = core.date). Swift và NAPAS so sánh ngày tương đối với core.date.',
    tabs: [
      { label: 'Ghi có (Đi)',  count: CORE_COLS_DI.length,  cols: CORE_COLS_DI,  condKey: 'CORE_DI' },
      { label: 'Ghi nợ (Đến)', count: CORE_COLS_DEN.length, cols: CORE_COLS_DEN, condKey: 'CORE_DEN' },
    ],
  },
]

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function DateRules() {
  const [activeTabs, setActiveTabs] = useState({ swift: 0, napas: 0, core: 0 })
  const [conds, setConds]           = useState(loadConds)

  const setTab = (sectionId, idx) => setActiveTabs(p => ({ ...p, [sectionId]: idx }))

  const handleSaveRow = (condKey, rowIdx, newChips) => {
    setConds(prev => {
      const next = { ...prev, [condKey]: prev[condKey].map((r, i) => i === rowIdx ? newChips : r) }
      persistConds(next)
      return next
    })
  }

  const handleReset = () => {
    setConds(DEFAULT_CONDS)
    localStorage.removeItem(LS_KEY)
  }

  const modified = JSON.stringify(conds) !== JSON.stringify(DEFAULT_CONDS)

  return (
    <PageShell
      title="Phân loại trạng thái đối soát"
      subtitle="Điều kiện dữ liệu tạo ra từng trạng thái — bấm ✎ để chỉnh sửa, lưu vào trình duyệt."
    >
      {/* Info bar */}
      <div style={{
        padding: '10px 14px', marginBottom: modified ? 10 : 20,
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: radius.md,
        fontSize: 13, color: '#1e40af', display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ</span>
        <span style={{ flex: 1 }}>
          Bấm <b>✎</b> trên từng dòng để chỉnh sửa điều kiện. Thay đổi được lưu vào bộ nhớ trình duyệt.
        </span>
        {modified && (
          <button onClick={handleReset} style={{
            flexShrink: 0, fontSize: 11, padding: '4px 12px', borderRadius: 5,
            border: '1px solid #fecaca', background: '#fef2f2',
            color: '#dc2626', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>↺ Khôi phục mặc định</button>
        )}
      </div>

      {/* Modified warning */}
      {modified && (
        <div style={{
          marginBottom: 20, padding: '8px 14px',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: radius.md,
          fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontWeight: 700 }}>⚠</span>
          Cấu hình đang khác mặc định — các thay đổi chỉ ảnh hưởng đến hiển thị tài liệu trên trang này.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {SECTIONS.map(sec => {
          const activeIdx = activeTabs[sec.id]
          const tab = sec.tabs[activeIdx]
          return (
            <div key={sec.id} style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
              {/* Section header */}
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.cardBorder}`, background: sec.accentBg, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: sec.accent }}>{sec.title}</span>
                <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{sec.note}</span>
              </div>

              {/* Direction tabs */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.cardBorder}`, background: C.neutralBg }}>
                {sec.tabs.map((t, i) => {
                  const active = i === activeIdx
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
                        {t.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Table */}
              <div style={{ padding: 16 }}>
                <ColTable
                  cols={tab.cols}
                  rowConds={conds[tab.condKey] ?? []}
                  condKey={tab.condKey}
                  onSaveRow={handleSaveRow}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 20, padding: '12px 16px', background: C.neutralBg, border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Chú thích toán tử</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(OP_COLOR).map(([op, c]) => (
            <span key={op} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted }}>
              <span style={{ padding: '1px 8px', borderRadius: 4, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: 'monospace' }}>{op}</span>
              {{ '=': 'bằng', '≠': 'khác / có giá trị', '<': 'nhỏ hơn (ngày trước)', '>': 'lớn hơn (ngày sau)' }[op]}
            </span>
          ))}
        </div>
      </div>
    </PageShell>
  )
}
