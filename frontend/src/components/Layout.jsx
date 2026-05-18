import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { C, shadow } from '../theme'

const NAV_GROUPS = [
  {
    label: 'CẤU HÌNH',
    items: [
      { to: '/file-settings', label: 'Loại file & Trường dữ liệu', icon: FileSettingsIcon },
    ],
  },
  {
    label: 'DỮ LIỆU',
    items: [
      { to: '/data-input', label: 'Nhập dữ liệu',  icon: UploadIcon },
      { to: '/history',    label: 'Lịch sử',        icon: HistoryIcon },
      { to: '/storage',    label: 'Kho dữ liệu',    icon: StorageIcon },
    ],
  },
  {
    label: 'XỬ LÝ',
    items: [
      { to: '/join-logic', label: 'Logic đối soát', icon: LogicIcon },
      { to: '/reports',    label: 'Báo cáo',        icon: ReportIcon },
    ],
  },
  {
    label: 'QUẢN TRỊ',
    items: [
      { to: '/settings', label: 'Cài đặt', icon: SettingsIcon },
    ],
  },
]

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif", background: C.bg }}>
      <aside style={{
        width: collapsed ? 56 : 224,
        minWidth: collapsed ? 56 : 224,
        background: C.sidebar,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>
        {/* Brand */}
        <div style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          borderBottom: `1px solid ${C.sidebarBorder}`,
          display: 'flex',
          alignItems: 'center',
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
            onClick={() => setCollapsed(!collapsed)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sidebarGroup, padding: 4, borderRadius: 4, lineHeight: 1 }}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {/* Nav groups */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {NAV_GROUPS.map((group, gi) => (
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
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: collapsed ? '9px 0' : '9px 12px',
                    margin: '1px 8px',
                    borderRadius: 7,
                    textDecoration: 'none',
                    color: isActive ? C.sidebarActiveText : C.sidebarText,
                    background: isActive ? C.sidebarActive : 'transparent',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    transition: 'background 0.12s',
                  })}
                >
                  <span style={{ flexShrink: 0, width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <item.icon />
                  </span>
                  {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                </NavLink>
              ))}
              {gi < NAV_GROUPS.length - 1 && !collapsed && (
                <div style={{ height: 1, background: C.sidebarBorder, margin: '8px 16px 4px' }} />
              )}
            </div>
          ))}
        </nav>

        {/* User footer */}
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.sidebarBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.sidebarActive, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>A</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb' }}>Admin</div>
                <div style={{ fontSize: 10, color: C.sidebarGroup }}>Quản trị viên</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, padding: '28px 32px', minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}

function FileSettingsIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> }
function UploadIcon()       { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> }
function HistoryIcon()      { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> }
function StorageIcon()      { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg> }
function LogicIcon()        { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> }
function ReportIcon()       { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> }
function SettingsIcon()     { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> }
