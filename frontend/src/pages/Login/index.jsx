import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { C, radius, shadow } from '../../theme'

const DEMO_USERS = [
  { username: 'admin',    password: 'admin123', role: 'Admin',    color: '#1d4ed8' },
  { username: 'operator', password: 'op123',    role: 'Vận hành', color: '#059669' },
  { username: 'viewer',   password: 'view123',  role: 'Xem',      color: '#64748b' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]     = useState({ username: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Vui lòng nhập đầy đủ thông tin.'); return }
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 500))
    const ok = login(form.username, form.password)
    setLoading(false)
    if (ok) navigate('/dashboard', { replace: true })
    else    setError('Tên đăng nhập hoặc mật khẩu không đúng.')
  }

  const loginAs = async (username, password) => {
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 400))
    const ok = login(username, password)
    setLoading(false)
    if (ok) navigate('/dashboard', { replace: true })
  }

  const inputStyle = (hasErr) => ({
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px',
    border: `1px solid ${hasErr ? C.errorBorder : C.cardBorder}`,
    borderRadius: radius.md,
    fontSize: 13, color: C.text,
    fontFamily: 'inherit', outline: 'none',
    transition: 'border-color 0.15s',
  })

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #111827 100%)',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        width: 400,
        background: '#fff',
        borderRadius: radius.xl,
        boxShadow: shadow.xl,
        padding: '40px 40px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* top accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)',
        }} />

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52,
            background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            borderRadius: radius.lg, marginBottom: 14,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: 0.4 }}>VCBNeo</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
            Hệ thống Đối soát NAPAS · Ngân hàng Xây dựng Việt Nam
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Tên đăng nhập
            </label>
            <input
              type="text" autoFocus autoComplete="username"
              value={form.username} onChange={set('username')}
              placeholder="admin"
              style={inputStyle(!!error)}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>
              Mật khẩu
            </label>
            <input
              type="password" autoComplete="current-password"
              value={form.password} onChange={set('password')}
              placeholder="••••••••"
              style={inputStyle(!!error)}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: 16,
              background: C.errorBg, border: `1px solid ${C.errorBorder}`,
              borderRadius: radius.md, fontSize: 13, color: C.error,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: 11,
              background: loading ? '#93c5fd' : C.primary,
              color: '#fff', border: 'none',
              borderRadius: radius.md, fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Demo accounts — click to login instantly */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Tài khoản demo — nhấn để đăng nhập
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.username}
                type="button"
                disabled={loading}
                onClick={() => loginAs(u.username, u.password)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', border: `1px solid ${C.cardBorder}`, borderRadius: radius.md, cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%', transition: 'background 0.12s, border-color 0.12s' }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe' } }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = C.cardBorder }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {u.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{u.username}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{u.role}</div>
                </div>
                <div style={{ fontSize: 11, color: C.textLight }}>Đăng nhập →</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
