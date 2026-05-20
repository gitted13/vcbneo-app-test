import { useState, useRef, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { C, shadow } from '../theme'

const NAV_GROUPS = [
  {
    label: 'DASHBOARD',
    items: [
      { to: '/reports',  label: 'Dashboard',   icon: DashboardIcon, roles: ['Admin', 'Operator', 'Viewer'] },
      { to: '/chatbot',  label: 'Trợ lý AI',   icon: ChatbotIcon,   roles: ['Admin', 'Operator', 'Viewer'] },
    ],
  },
  {
    label: 'DỮ LIỆU',
    items: [
      { to: '/data-input', label: 'Tải lên dữ liệu', icon: UploadIcon,  roles: ['Admin', 'Operator'] },
      { to: '/storage',    label: 'Kho dữ liệu',     icon: StorageIcon, roles: ['Admin', 'Operator', 'Viewer'] },
    ],
  },
  {
    label: 'CẤU HÌNH',
    items: [
      { to: '/file-settings', label: 'Cấu hình file',      icon: FileSettingsIcon, roles: ['Admin'] },
      { to: '/join-logic',    label: 'Cấu hình đối chiếu', icon: LogicIcon,        roles: ['Admin', 'Operator'] },
      { to: '/date-rules',    label: 'Phân loại trạng thái', icon: DateRulesIcon,    roles: ['Admin', 'Operator', 'Viewer'] },
    ],
  },
  {
    label: 'ĐỐI SOÁT',
    items: [
      { to: '/swift-core',   label: 'Swift – Core GL',      icon: SwiftCoreIcon,   roles: ['Admin', 'Operator', 'Viewer'] },
      { to: '/napas-core',   label: 'NAPAS – Core GL',      icon: NapasCoreIcon,   roles: ['Admin', 'Operator', 'Viewer'] },
      { to: '/core-summary', label: 'Core GL – Tổng hợp',  icon: CoreSummaryIcon, roles: ['Admin', 'Operator', 'Viewer'] },
      { to: '/master',       label: 'Tổng hợp 3 nguồn',   icon: MasterIcon,      roles: ['Admin', 'Operator', 'Viewer'] },
    ],
  },
  {
    label: 'QUẢN TRỊ',
    items: [
      { to: '/settings', label: 'Cài đặt', icon: SettingsIcon, roles: ['Admin'] },
    ],
  },
]

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout }          = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const navGroups  = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => !item.roles || item.roles.includes(user?.role)) }))
    .filter(g => g.items.length > 0)
  const roleColor  = { Admin: C.primary, Operator: C.success, Viewer: C.textMuted }[user?.role] ?? C.textMuted
  const initials   = user?.name?.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase() ?? '?'

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif", background: C.bg }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside style={{
        width: collapsed ? 56 : 224,
        minWidth: collapsed ? 56 : 224,
        background: C.sidebar,
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          borderBottom: `1px solid ${C.sidebarBorder}`,
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
        }}>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>VCBNeo</div>
              <div style={{ fontSize: 10, color: C.sidebarGroup, marginTop: 1 }}>Đối soát NAPAS</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sidebarGroup, padding: 4, borderRadius: 4, lineHeight: 1 }}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {navGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <div style={{ fontSize: 10, fontWeight: 700, color: C.sidebarGroup, padding: '10px 16px 4px', letterSpacing: 0.8 }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: collapsed ? '9px 0' : '9px 12px',
                    margin: '1px 8px',
                    borderRadius: 7,
                    textDecoration: 'none',
                    color: isActive ? C.sidebarActiveText : C.sidebarText,
                    background: isActive ? C.sidebarActive : 'transparent',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    transition: 'background 0.12s',
                  })}
                >
                  <span style={{ flexShrink: 0, width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <item.icon />
                  </span>
                  {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                </NavLink>
              ))}
              {gi < navGroups.length - 1 && !collapsed && (
                <div style={{ height: 1, background: C.sidebarBorder, margin: '8px 16px 4px' }} />
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Right column: header + main ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── Top header ───────────────────────────────────────────────────── */}
        <header style={{
          height: 52, flexShrink: 0,
          background: '#fff',
          borderBottom: `1px solid ${C.cardBorder}`,
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 12,
          boxShadow: shadow.sm,
        }}>
          <div style={{ flex: 1 }} />

          {/* Notification bell */}
          <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
            <BellIcon />
            <span style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%', background: C.error, border: '2px solid #fff' }} />
          </button>

          {/* User menu */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'none', border: `1px solid ${C.cardBorder}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{user?.name}</div>
                <div style={{ fontSize: 10, color: roleColor, fontWeight: 600 }}>{user?.role}</div>
              </div>
              <ChevronIcon />
            </button>

            {userMenuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: '#fff', border: `1px solid ${C.cardBorder}`,
                borderRadius: 10, boxShadow: shadow.lg,
                minWidth: 180, zIndex: 100, overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{user?.email}</div>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); logout() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: C.error, fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <LogoutIcon />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

/* ── Icons ──────────────────────────────────────────────────────────────────── */
function DashboardIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg> }
function ChatbotIcon()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg> }
function FileSettingsIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> }
function UploadIcon()       { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> }
function StorageIcon()      { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> }
function LogicIcon()        { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> }
function ReportIcon()       { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function SettingsIcon()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> }
function BellIcon()         { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> }
function ChevronIcon()      { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg> }
function LogoutIcon()       { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function ReconcileIcon()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> }
function MasterIcon()       { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> }
function SwiftCoreIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg> }
function NapasCoreIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/><path d="M8 5.5h4a2 2 0 012 2v9a2 2 0 002 2h0"/><path d="M8 5.5l2-2m-2 2l2 2"/></svg> }
function CoreSummaryIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> }
function DateRulesIcon()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg> }
