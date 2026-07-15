import { useState, useEffect } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import { Input, Select } from '../../components/Input'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'
import { api } from '../../api/client'

const PALETTE = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#64748b', '#0891b2', '#be185d']

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C.cardBorder}`, marginBottom: 20 }}>
      {tabs.map((tab, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            padding: '10px 20px', border: 'none', background: 'none',
            borderBottom: active === i ? `2px solid ${C.primary}` : '2px solid transparent',
            color: active === i ? C.primary : C.textMuted,
            fontWeight: active === i ? 700 : 500,
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.12s', marginBottom: -1,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export default function DataInput() {
  const [activeTab, setActiveTab] = useState(0)
  const [dbTypes, setDbTypes] = useState([])
  const TABS = ['Tải lên thủ công', 'Lịch sử tải lên']

  const reloadTypes = () => api.flex.getTypes('reconcile').then(setDbTypes).catch(() => {})

  useEffect(() => { reloadTypes() }, [])

  return (
    <PageShell
      title="Tải lên dữ liệu"
      subtitle="Tải file thủ công hoặc xem lịch sử nạp dữ liệu. File sẽ được kiểm tra theo cấu hình loại file."
    >
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === 0
        ? <ManualTab dbTypes={dbTypes} onReloadTypes={reloadTypes} />
        : <HistoryTab dbTypes={dbTypes} onReloadTypes={reloadTypes} />}
    </PageShell>
  )
}

/* ── Manual Tab ─────────────────────────────────────────────────────────────── */
function ManualTab({ dbTypes, onReloadTypes }) {
  const { toast, showConfirm } = useApp()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [files, setFiles]       = useState({})   // id → { file, name, size }
  const [results, setResults]   = useState({})   // id → upload result | { _error }
  const [uploading, setUploading] = useState(new Set())

  const fileTypes = dbTypes.map((t, i) => ({
    id: t.id,
    name: t.upload_name,
    color: PALETTE[i % PALETTE.length],
    schema: t.fields_schema || {},
  }))

  const handleWipeType = (ft) => showConfirm({
    title: `Xóa toàn bộ dữ liệu "${ft.name}"?`,
    message: 'Toàn bộ dữ liệu đã tải lên và kết quả đối soát liên quan tới loại file này sẽ bị xóa vĩnh viễn. Không thể hoàn tác.',
    variant: 'danger',
    confirmLabel: 'Xóa dữ liệu',
    onConfirm: () => {
      api.flex.purge(ft.id)
        .then(() => {
          setResults(prev => { const n = { ...prev }; delete n[ft.id]; return n })
          toast(`Đã xóa toàn bộ dữ liệu của "${ft.name}".`, 'success')
        })
        .catch(e => toast(`Xóa thất bại: ${e.message}`, 'error'))
    },
  })

  const handleDrop = (id, f) => {
    if (f === null) {
      setFiles(prev => { const n = { ...prev }; delete n[id]; return n })
      setResults(prev => { const n = { ...prev }; delete n[id]; return n })
    } else {
      setFiles(prev => ({ ...prev, [id]: { file: f, name: f.name, size: f.size } }))
      setResults(prev => { const n = { ...prev }; delete n[id]; return n })
    }
  }

  const handleUploadOne = async (ft) => {
    if (!files[ft.id]?.file) return
    setUploading(prev => new Set([...prev, ft.id]))
    try {
      const res = await api.flex.upload(ft.id, files[ft.id].file)
      setResults(prev => ({ ...prev, [ft.id]: res }))
      if (res.status === 'ok' && res.error_count === 0) {
        toast(`${ft.name}: ${res.row_count} dòng đã lưu.`, 'success')
      } else if (res.status === 'ok') {
        toast(`${ft.name}: ${res.row_count} dòng lưu, ${res.error_count} dòng có cảnh báo.`, 'success')
      } else {
        toast(`${ft.name}: ${res.error_count} lỗi, dữ liệu chưa đầy đủ.`, 'error')
      }
    } catch (e) {
      setResults(prev => ({ ...prev, [ft.id]: { _error: e.message } }))
      toast(`${ft.name}: ${e.message}`, 'error')
    } finally {
      setUploading(prev => { const s = new Set(prev); s.delete(ft.id); return s })
    }
  }

  if (dbTypes.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
        Đang tải cấu hình loại file từ DB...
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <Button size="sm" variant="ghost" onClick={onReloadTypes} title="Nạp lại cấu hình loại file mới nhất từ Cấu hình loại file">
          Làm mới cấu hình
        </Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
      {fileTypes.map(ft => (
        <UploadSlot
          key={ft.id}
          ft={ft}
          fileInfo={files[ft.id]}
          result={results[ft.id]}
          uploading={uploading.has(ft.id)}
          isAdmin={isAdmin}
          onDrop={(f) => handleDrop(ft.id, f)}
          onUpload={() => handleUploadOne(ft)}
          onWipe={() => handleWipeType(ft)}
        />
      ))}
      </div>
    </div>
  )
}

function UploadSlot({ ft, fileInfo, result, uploading, isAdmin, onDrop, onUpload, onWipe }) {
  const columns  = ft.schema?.columns || []
  const fromFile = columns.filter(c => c.col_name)
  const fixed    = columns.filter(c => c.fixed_value != null && c.fixed_value !== '')
  const required = fromFile.filter(c => c.required)
  const withAllowedValues = fromFile.filter(c => Array.isArray(c.allowed_values) && c.allowed_values.length > 0)

  const [dragging, setDragging] = useState(false)

  const handleChange  = (e) => { if (e.target.files?.[0]) onDrop(e.target.files[0]); e.target.value = '' }
  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)
  const handleDropEvt   = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) onDrop(e.dataTransfer.files[0]) }

  const hasFile   = !!fileInfo
  const hasResult = !!result

  const resultOk   = hasResult && !result._error && result.status === 'ok' && result.error_count === 0
  const resultWarn = hasResult && !result._error && result.status === 'ok' && result.error_count > 0
  const resultErr  = hasResult && (!result._error ? result.status !== 'ok' : true)

  const borderColor = hasResult
    ? (resultOk ? C.success : resultWarn ? C.warning : C.error)
    : dragging ? ft.color : C.cardBorder

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: radius.lg, overflow: 'hidden', background: '#fff', boxShadow: shadow.sm, transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '11px 14px', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', gap: 8, background: C.neutralBg }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: ft.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>{ft.name}</span>
        {resultOk   && <Badge variant="success" dot>Đã tải</Badge>}
        {resultWarn && <Badge variant="warning" dot>{result.error_count} cảnh báo</Badge>}
        {resultErr  && <Badge variant="error"   dot>Lỗi</Badge>}
        {isAdmin && (
          <button
            onClick={onWipe}
            title={`Xóa toàn bộ dữ liệu đã tải của "${ft.name}"`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 13, padding: '0 2px', lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.color = C.error }}
            onMouseLeave={e => { e.currentTarget.style.color = C.textLight }}
          >🗑</button>
        )}
      </div>

      {/* Schema info from DB */}
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.cardBorder}`, fontSize: 11, background: '#fafafa' }}>
        {columns.length === 0 ? (
          <span style={{ color: C.textLight, fontStyle: 'italic' }}>Chưa cấu hình cột</span>
        ) : (
          <>
            <span style={{ color: C.textMuted }}>
              {fromFile.length} cột đọc từ file
              {fixed.length > 0 && <span> · {fixed.length} cột tự điền</span>}
            </span>
            {required.length > 0 && (
              <div style={{ marginTop: 3 }}>
                <span style={{ color: C.error, fontWeight: 700 }}>* </span>
                <span style={{ color: C.textMuted }}>Bắt buộc: </span>
                <span style={{ color: C.text, fontWeight: 500 }}>{required.map(c => c.col_name).join(', ')}</span>
              </div>
            )}
            {withAllowedValues.length > 0 && (
              <div style={{ marginTop: 3 }}>
                <span style={{ color: C.textMuted }}>Giá trị hợp lệ: </span>
                {withAllowedValues.map(c => (
                  <span key={c.field_name} style={{ color: C.text }}>
                    {c.col_name} (<span style={{ fontFamily: 'monospace' }}>{c.allowed_values.join(', ')}</span>){c !== withAllowedValues[withAllowedValues.length - 1] ? '; ' : ''}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDropEvt}
        style={{ padding: '14px', flex: 1, background: dragging ? C.primaryLight : '#fff', transition: 'background 0.15s', minHeight: 52 }}
      >
        {hasFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileInfo.name}
            </span>
            <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
              {(fileInfo.size / 1024).toFixed(0)} KB
            </span>
            <button
              onClick={() => onDrop(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
            >×</button>
          </div>
        ) : (
          <label htmlFor={`slot-${ft.id}`} style={{ display: 'block', textAlign: 'center', fontSize: 12, color: C.textLight, cursor: 'pointer', padding: '6px 0' }}>
            Kéo file vào đây hoặc <span style={{ color: ft.color, fontWeight: 600 }}>nhấn để chọn</span>
            <input id={`slot-${ft.id}`} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleChange} />
          </label>
        )}
      </div>

      {/* Upload button */}
      {hasFile && (
        <div style={{ padding: '0 14px 12px' }}>
          <Button size="sm" disabled={uploading} onClick={onUpload} style={{ width: '100%' }}>
            {uploading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Spinner />Đang xử lý...</span>
              : 'Tải lên'
            }
          </Button>
        </div>
      )}

      {/* Upload result */}
      {hasResult && (
        <div style={{
          padding: '10px 14px', borderTop: `1px solid ${C.cardBorder}`, fontSize: 12,
          background: resultOk ? '#f0fdf4' : resultWarn ? '#fffbeb' : '#fef2f2',
        }}>
          {result._error ? (
            <div style={{ color: C.error }}>⚠ {result._error}</div>
          ) : (
            <>
              <div style={{ fontWeight: 600, color: resultOk ? C.success : resultWarn ? C.warning : C.error }}>
                {resultOk ? '✓' : '⚠'} {Number(result.row_count).toLocaleString()} dòng đã lưu
                {result.duplicate_count > 0 && (
                  <span style={{ fontWeight: 400, color: C.textMuted }}> · {result.duplicate_count} trùng bỏ qua</span>
                )}
                {result.error_count > 0 && (
                  <span style={{ fontWeight: 400, color: resultErr ? C.error : C.warning }}>
                    {' '}· {result.error_count} dòng có vấn đề
                  </span>
                )}
              </div>
              {result.errors?.slice(0, 3).map((e, i) => (
                <div key={i} style={{ color: C.error, marginTop: 3, fontSize: 11 }}>
                  Dòng {e.row} · <b>{e.field}</b>: {e.reason}
                </div>
              ))}
              {result.errors?.length > 3 && (
                <div style={{ color: C.textMuted, marginTop: 2, fontSize: 11 }}>
                  ...và {result.errors.length - 3} lỗi khác
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── History Tab ─────────────────────────────────────────────────────────────── */
function HistoryTab({ dbTypes, onReloadTypes }) {
  const { toast, showConfirm } = useApp()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'
  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch]       = useState('')

  const typeColorMap = Object.fromEntries(dbTypes.map((t, i) => [t.id, PALETTE[i % PALETTE.length]]))

  const load = () => {
    setLoading(true)
    api.flex.getFiles()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

useEffect(() => { load() }, [])

  const handleDeleteFile = (r) => showConfirm({
    title: `Xóa file "${r.original_name}"?`,
    message: 'File này sẽ bị loại khỏi lịch sử và dữ liệu đối soát liên quan. Không thể hoàn tác.',
    variant: 'danger',
    confirmLabel: 'Xóa',
    onConfirm: () => {
      api.flex.deleteFile(r.id)
        .then(() => { load(); toast(`Đã xóa file "${r.original_name}".`, 'success') })
        .catch(e => toast(`Xóa thất bại: ${e.message}`, 'error'))
    },
  })

  const handleWipeAll = () => showConfirm({
    title: 'Xóa TOÀN BỘ dữ liệu đã tải lên?',
    message: 'Thao tác này xóa vĩnh viễn toàn bộ dữ liệu đã tải (mọi loại file) và toàn bộ kết quả đối soát đã chạy. Không thể hoàn tác.',
    variant: 'danger',
    confirmLabel: 'Xóa tất cả',
    onConfirm: () => {
      api.flex.purge()
        .then(() => { load(); onReloadTypes?.(); toast('Đã xóa toàn bộ dữ liệu đã tải lên.', 'success') })
        .catch(e => toast(`Xóa thất bại: ${e.message}`, 'error'))
    },
  })

  const typeNames = [...new Set(rows.map(r => r.upload_name).filter(Boolean))]

  const filtered = rows.filter(r => {
    if (filterType && r.upload_name !== filterType) return false
    if (filterStatus === 'ok'    && r.status !== 'ok')  return false
    if (filterStatus === 'error' && r.status === 'ok')  return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.original_name?.toLowerCase().includes(q) && !r.upload_name?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = [
    { label: 'Tổng file', val: rows.length,                               color: C.primary, bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '#bfdbfe' },
    { label: 'Hợp lệ',    val: rows.filter(r => r.status === 'ok').length, color: C.success, bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#bbf7d0' },
    { label: 'Lỗi',       val: rows.filter(r => r.status !== 'ok').length, color: C.error,   bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fecaca' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.border}`, borderRadius: radius.md, padding: '14px 16px', textAlign: 'center', boxShadow: shadow.sm }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <Button size="sm" variant="ghost" onClick={load}>Làm mới</Button>
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={handleWipeAll} style={{ color: C.error }}>
              Xóa toàn bộ dữ liệu
            </Button>
          )}
        </div>
      </div>

      <Card noPad>
        <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${C.cardBorder}`, flexWrap: 'wrap' }}>
          <Input
            placeholder="Tìm theo tên file, loại..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 200 }}>
            <option value="">Tất cả loại file</option>
            {typeNames.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 150 }}>
            <option value="">Tất cả trạng thái</option>
            <option value="ok">Hợp lệ</option>
            <option value="error">Lỗi</option>
          </Select>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: 14 }}>Đang tải...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Thời gian', 'Loại file', 'Tên file', 'Người dùng', 'Số dòng', 'Trạng thái', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 0', textAlign: 'center', color: C.textLight, fontSize: 13 }}>
                    Chưa có file nào được tải lên
                  </td>
                </tr>
              ) : filtered.map((r, i) => {
                const typeColor = typeColorMap[r.upload_type_id] ?? C.primary
                return (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 ? C.neutralBg : '#fff' }}>
                    <td style={{ padding: '10px 14px', color: C.textMuted, whiteSpace: 'nowrap', fontSize: 12 }}>{r.created}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: typeColor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: C.text }}>{r.upload_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: typeColor }}>{r.original_name}</td>
                    <td style={{ padding: '10px 14px', color: C.textMuted, fontSize: 12 }}>{r.created_by}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: r.row_count ? C.text : C.textLight }}>
                      {r.row_count != null ? Number(r.row_count).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Badge variant={r.status === 'ok' ? 'success' : 'error'} dot>
                        {r.status === 'ok' ? 'Hợp lệ' : 'Lỗi'}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteFile(r)}
                          title={`Xóa file "${r.original_name}"`}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, fontSize: 13 }}
                          onMouseEnter={e => { e.currentTarget.style.color = C.error }}
                          onMouseLeave={e => { e.currentTarget.style.color = C.textLight }}
                        >🗑</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div style={{ padding: '12px 16px', color: C.textMuted, fontSize: 12, borderTop: `1px solid ${C.cardBorder}` }}>
          Hiển thị <b>{filtered.length}</b> / {rows.length} bản ghi (từ DB)
        </div>
      </Card>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 12, height: 12,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}
