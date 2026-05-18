import { useState } from 'react'
import PageShell from '../../components/PageShell'
import Card from '../../components/Card'
import Tabs from '../../components/Tabs'
import Badge from '../../components/Badge'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { Input, Select, FormRow } from '../../components/Input'
import { C, radius, shadow } from '../../theme'

export default function AppSettings() {
  return (
    <PageShell title="Cài đặt ứng dụng" subtitle="Cấu hình chung, phân quyền, kết nối RPA và thông báo hệ thống.">
      <Tabs tabs={['Chung', 'Phân quyền', 'Kết nối RPA', 'Thông báo']}>
        <GeneralTab />
        <RolesTab />
        <RPAConnTab />
        <NotifTab />
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
const MODULES = ['Loại file', 'Nhập dữ liệu', 'Lịch sử', 'Kho dữ liệu', 'Logic', 'Báo cáo', 'Cài đặt']

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

  const roleBadge = (role) => {
    const map = { Admin: 'error', Operator: 'primary', Viewer: 'neutral' }
    return <Badge variant={map[role] ?? 'neutral'}>{role}</Badge>
  }

  const togglePerm   = (uid, idx) => setUsers(p => p.map(u => u.id === uid ? { ...u, perms: u.perms.map((v,i) => i===idx ? 1-v : v) } : u))
  const toggleActive = (uid)      => setUsers(p => p.map(u => u.id === uid ? { ...u, active: !u.active } : u))

  const active = users.filter(u => u.active).length

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
              {users.map((u, i) => (
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
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderBottom: `1px solid #fde68a` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>Kết nối thư mục</div>
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Đường dẫn thư mục nguồn & lưu trữ</div>
        </div>
        <div style={{ padding: '20px' }}>
          <FormRow label="Thư mục nguồn RPA" hint="RPA sẽ đẩy file vào thư mục này"><Input defaultValue="\\\\server\\rpa\\vcbneo\\input" /></FormRow>
          <FormRow label="Thư mục lưu trữ" hint="File sau khi xử lý sẽ được di chuyển đây"><Input defaultValue="\\\\server\\rpa\\vcbneo\\archive" /></FormRow>
          <FormRow label="Pattern tên file" hint="Regex hoặc glob để lọc đúng file"><Input defaultValue="*.xlsx" /></FormRow>
          <Button size="sm">Lưu &amp; Kiểm tra kết nối</Button>
        </div>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', borderBottom: `1px solid #c4b5fd` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>Lịch chạy tự động</div>
          <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 2 }}>Cron, ngày trong tuần</div>
        </div>
        <div style={{ padding: '20px' }}>
          <FormRow label="Bật tự động hóa">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: C.primary, width: 15, height: 15 }} />
              Kích hoạt lịch chạy RPA
            </label>
          </FormRow>
          <FormRow label="Thời gian chạy (HH:MM)"><Input type="time" defaultValue="06:00" /></FormRow>
          <FormRow label="Ngày trong tuần">
            {['T2','T3','T4','T5','T6','T7','CN'].map((d, i) => (
              <label key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked={i < 5} style={{ accentColor: C.primary }} />
                {d}
              </label>
            ))}
          </FormRow>
          <Button size="sm">Lưu lịch</Button>
        </div>
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
