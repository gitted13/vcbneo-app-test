import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Tabs from '../../components/Tabs'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { Input, Select, FormRow } from '../../components/Input'
import Pagination from '../../components/Pagination'
import { C, radius, shadow } from '../../theme'
import { RECON_STATUS_META, RESOLUTION_OF } from '../../data/reconcile'

export default function AppSettings() {
  return (
    <PageShell title="Cài đặt ứng dụng" subtitle="Cấu hình chung, phân quyền, kết nối RPA và thông báo hệ thống.">
      <Tabs tabs={['Chung', 'Phân quyền', 'Kết nối RPA', 'Thông báo', 'Trạng thái đối soát']}>
        <GeneralTab />
        <RolesTab />
        <RPAConnTab />
        <NotifTab />
        <ReconStatusTab />
      </Tabs>
    </PageShell>
  )
}

/* ── General ────────────────────────────────────────────────────────────────── */
function SectionHeader({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 4, height: 18, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
    </div>
  )
}

function GeneralTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', borderBottom: `1px solid #bfdbfe` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>Thông tin ứng dụng</div>
          <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Tên, đơn vị, múi giờ</div>
        </div>
        <div style={{ padding: '20px' }}>
          <FormRow label="Tên ứng dụng"><Input defaultValue="VCBNeo – Đối soát NAPAS" /></FormRow>
          <FormRow label="Tên ngân hàng"><Input defaultValue="Ngân hàng TM TNHH MTV Xây dựng Việt Nam" /></FormRow>
          <FormRow label="Đơn vị"><Input defaultValue="TTTT" /></FormRow>
          <FormRow label="Múi giờ">
            <Select defaultValue="Asia/Ho_Chi_Minh">
              <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</option>
            </Select>
          </FormRow>
          <Button size="sm">Lưu thay đổi</Button>
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderBottom: `1px solid #bbf7d0` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>Lưu trữ &amp; Hiệu năng</div>
          <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>Upload, cache, giới hạn</div>
        </div>
        <div style={{ padding: '20px' }}>
          <FormRow label="Thư mục upload" hint="File tải lên sẽ lưu tạm ở đây">
            <Input defaultValue="./uploads" />
          </FormRow>
          <FormRow label="Thời gian lưu cache (giây)">
            <Input type="number" defaultValue={300} />
          </FormRow>
          <FormRow label="Giới hạn kích thước file (MB)">
            <Input type="number" defaultValue={200} />
          </FormRow>
          <FormRow label="Số dòng tối đa xuất CSV">
            <Input type="number" defaultValue={100000} />
          </FormRow>
          <Button size="sm">Lưu thay đổi</Button>
        </div>
      </div>
    </div>
  )
}

/* ── Roles ──────────────────────────────────────────────────────────────────── */
const MODULES = ['Cấu hình file', 'Tải lên dữ liệu', 'Kho dữ liệu', 'Quy tắc so khớp', 'Đối soát', 'Báo cáo', 'Cài đặt']

const INIT_USERS = [
  { id: 1, name: 'Nguyễn Văn A', email: 'nva@vcb.com.vn', role: 'Admin',    active: true,  perms: [1,1,1,1,1,1,1] },
  { id: 2, name: 'Trần Thị B',   email: 'ttb@vcb.com.vn', role: 'Operator', active: true,  perms: [0,1,1,1,1,1,0] },
  { id: 3, name: 'Lê Văn C',     email: 'lvc@vcb.com.vn', role: 'Viewer',   active: true,  perms: [0,0,1,1,0,1,0] },
  { id: 4, name: 'Phạm Thị D',   email: 'ptd@vcb.com.vn', role: 'Operator', active: false, perms: [0,1,1,1,0,1,0] },
]

function RolesTab() {
  const [users, setUsers] = useState(INIT_USERS)
  const [userModal, setUserModal] = useState(false)
  const [editUser, setEditUser]   = useState(null)
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(10)

  const roleBadge = (role) => {
    const map = { Admin: 'error', Operator: 'primary', Viewer: 'neutral' }
    return <Badge variant={map[role] ?? 'neutral'}>{role}</Badge>
  }

  const togglePerm   = (uid, idx) => setUsers(p => p.map(u => u.id === uid ? { ...u, perms: u.perms.map((v,i) => i===idx ? 1-v : v) } : u))
  const toggleActive = (uid)      => setUsers(p => p.map(u => u.id === uid ? { ...u, active: !u.active } : u))

  const active = users.filter(u => u.active).length
  const pageRows = users.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div>
      {/* Role summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Đang hoạt động', val: active,              color: C.success,  bg: '#f0fdf4', border: '#bbf7d0' },
          { label: 'Tổng người dùng', val: users.length,       color: C.primary,  bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Admin',           val: users.filter(u=>u.role==='Admin').length,    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
          { label: 'Operator',        val: users.filter(u=>u.role==='Operator').length, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Viewer',          val: users.filter(u=>u.role==='Viewer').length,   color: '#64748b', bg: C.neutralBg, border: C.cardBorder },
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 16px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: radius.md, textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <Card
        title="Người dùng & quyền truy cập"
        actions={<Button size="sm" onClick={() => { setEditUser(null); setUserModal(true) }}>+ Thêm người dùng</Button>}
        noPad
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Người dùng', 'Vai trò', 'Trạng thái', ...MODULES, ''].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.textMuted, background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${C.cardBorder}`, background: i % 2 ? C.neutralBg : '#fff', opacity: u.active ? 1 : 0.55 }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: C.text }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{roleBadge(u.role)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <Badge variant={u.active ? 'success' : 'neutral'} dot>{u.active ? 'Hoạt động' : 'Vô hiệu'}</Badge>
                  </td>
                  {u.perms.map((p, idx) => (
                    <td key={idx} style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={!!p} onChange={() => togglePerm(u.id, idx)} style={{ accentColor: C.primary, width: 14, height: 14, cursor: 'pointer' }} />
                    </td>
                  ))}
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <Button size="sm" variant="ghost" onClick={() => { setEditUser(u); setUserModal(true) }}>Sửa</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(u.id)} style={{ color: u.active ? C.error : C.success }}>
                        {u.active ? 'Khóa' : 'Mở'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          total={users.length}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={setPageSize}
          itemLabel="người dùng"
        />
      </Card>

      <UserFormModal
        open={userModal}
        editing={editUser}
        onClose={() => setUserModal(false)}
        onSave={(data) => {
          if (editUser) setUsers(p => p.map(u => u.id === editUser.id ? { ...u, ...data } : u))
          else setUsers(p => [...p, { ...data, id: Date.now(), active: true, perms: [0,1,1,1,0,1,0] }])
          setUserModal(false)
        }}
      />
    </div>
  )
}

function UserFormModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(editing ?? { name: '', email: '', role: 'Operator' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open={open} title={editing ? 'Sửa người dùng' : 'Thêm người dùng'} onClose={onClose} onConfirm={() => onSave(form)} width={440}>
      <FormRow label="Họ và tên"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nguyễn Văn A" /></FormRow>
      <FormRow label="Email"><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@vcb.com.vn" /></FormRow>
      <FormRow label="Vai trò mặc định">
        <Select value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="Admin">Admin – Toàn quyền</option>
          <option value="Operator">Operator – Vận hành</option>
          <option value="Viewer">Viewer – Chỉ xem</option>
        </Select>
      </FormRow>
      {!editing && (
        <FormRow label="Mật khẩu tạm" hint="Người dùng sẽ được yêu cầu đổi mật khẩu khi đăng nhập lần đầu">
          <Input type="password" placeholder="Nhập mật khẩu tạm..." />
        </FormRow>
      )}
    </Modal>
  )
}

/* ── RPA Connection ─────────────────────────────────────────────────────────── */
function RPAConnTab() {
  const STATUS = {
    connected: true,
    lastRunId: 'RPA-0044', lastRun: '2026-02-05 06:00', lastRunStatus: 'success',
    nextScheduled: '2026-02-06 06:00',
    host: '\\\\rpa-server\\vcbneo', process: 'VCBNeo_NAPAS_Reconcile', uptime: '99.2%',
    schedule: 'T2–T6, 06:00',
    inputFolder: '\\\\server\\rpa\\vcbneo\\input',
    archiveFolder: '\\\\server\\rpa\\vcbneo\\archive',
    filePattern: '*.xlsx',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status banner */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '16px 24px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: radius.lg, boxShadow: shadow.sm }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>RPA đang kết nối và hoạt động</div>
          <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Host: <code style={{ color: C.primary, fontFamily: 'monospace' }}>{STATUS.host}</code></span>
            <span>Process: <code style={{ fontFamily: 'monospace', color: C.text }}>{STATUS.process}</code></span>
            <span>Uptime: <b style={{ color: C.success }}>{STATUS.uptime}</b></span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Lần chạy tiếp theo</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{STATUS.nextScheduled}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Lần chạy gần nhất', val: STATUS.lastRunId, sub: STATUS.lastRun,             color: C.primary, bg: '#eff6ff' },
          { label: 'Kết quả lần cuối', val: 'Thành công',     sub: '6/6 file nhận đủ',         color: C.success, bg: '#f0fdf4' },
          { label: 'Lịch chạy',        val: STATUS.schedule,  sub: 'Cron: 0 6 * * 1-5',        color: '#d97706', bg: '#fffbeb' },
        ].map(s => (
          <div key={s.label} style={{ padding: '16px 18px', background: s.bg, border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Read-only config */}
      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, overflow: 'hidden', boxShadow: shadow.sm }}>
        <div style={{ padding: '14px 20px', background: C.neutralBg, borderBottom: `1px solid ${C.cardBorder}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Cấu hình RPA hiện tại</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Chỉ đọc – cấu hình được quản lý bởi quản trị viên hệ thống</div>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'Thư mục nguồn',    val: STATUS.inputFolder },
            { label: 'Thư mục lưu trữ',  val: STATUS.archiveFolder },
            { label: 'Pattern tên file',  val: STATUS.filePattern },
            { label: 'Lịch chạy (Cron)', val: '0 6 * * 1-5  (T2–T6, 06:00)' },
          ].map(row => (
            <div key={row.label}>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
              <code style={{ fontSize: 12, color: C.text, background: C.neutralBg, padding: '4px 8px', borderRadius: 4, border: `1px solid ${C.cardBorder}`, display: 'block', wordBreak: 'break-all' }}>{row.val}</code>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: C.textMuted, padding: '10px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: radius.md }}>
        Để thay đổi cấu hình RPA, vui lòng liên hệ quản trị viên hệ thống. Lịch sử chạy chi tiết xem trong tab <b>Lịch sử tải lên</b> của module <b>Tải lên dữ liệu</b>.
      </div>
    </div>
  )
}

/* ── Recon Status Legend ────────────────────────────────────────────────────── */
function ReconStatusTab() {
  const entries = Object.entries(RECON_STATUS_META)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '12px 16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: radius.md, fontSize: 12, color: '#0284c7' }}>
        Đây là 10 trạng thái đối soát được sử dụng xuyên suốt hệ thống — trong bảng đối soát, báo cáo tổng hợp và bộ lọc.
        Mỗi trạng thái tương ứng với một kịch bản khớp/lệch cụ thể giữa Swift, NAPAS và Core GL.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {entries.map(([key, m]) => (
          <div key={key} style={{
            background: '#fff', border: `1px solid ${m.border ?? C.cardBorder}`,
            borderLeft: `4px solid ${m.color}`,
            borderRadius: radius.md, padding: '14px 16px',
            boxShadow: shadow.sm,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{
                padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                background: m.bg, color: m.color, border: `1px solid ${m.border ?? m.color}`,
                whiteSpace: 'nowrap',
              }}>
                {m.label}
              </span>
              <code style={{ fontSize: 10, color: C.textMuted, background: C.neutralBg, padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>
                {key}
              </code>
            </div>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, marginBottom: m.action ? 6 : 0 }}>
              {m.desc ?? '—'}
            </div>
            {RESOLUTION_OF[key] && (
              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                <span style={{ fontWeight: 700, color: C.textMuted }}>Xử lý:</span>
                <span style={{ fontWeight: 600, color: RESOLUTION_OF[key].color }}>{RESOLUTION_OF[key].label}</span>
                {RESOLUTION_OF[key].needsAction && (
                  <span style={{ fontSize:9, fontWeight:700, color:'#d97706', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:3, padding:'1px 5px' }}>Thủ công</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: C.textMuted, padding: '10px 14px', background: C.neutralBg, border: `1px solid ${C.cardBorder}`, borderRadius: radius.md }}>
        Các trạng thái này được định nghĩa trong <code style={{ fontFamily:'monospace' }}>frontend/src/data/reconcile.js</code> → <code style={{ fontFamily:'monospace' }}>RECON_STATUS_META</code>.
        Backend trả về mã trạng thái dưới dạng chuỗi (ví dụ: <code style={{ fontFamily:'monospace' }}>"KHOP"</code>) trong trường <code style={{ fontFamily:'monospace' }}>recon_status</code> của mỗi giao dịch.
      </div>
    </div>
  )
}

/* ── Notifications ──────────────────────────────────────────────────────────── */
function NotifTab() {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', borderBottom: `1px solid #bae6fd` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0284c7' }}>Cấu hình thông báo</div>
        <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 2 }}>Email, webhook, cảnh báo ngưỡng</div>
      </div>
      <div style={{ padding: '40px 20px' }}>
        <EmptyState
          title="Tính năng đang phát triển"
          description="Cấu hình email, webhook khi có lỗi upload, RPA thất bại hoặc đối soát chênh lệch quá ngưỡng."
        />
      </div>
    </div>
  )
}
