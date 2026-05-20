import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const MOCK_USERS = [
  { username: 'admin',    password: 'admin123', name: 'Nguyễn Văn Admin',  role: 'Admin',    email: 'admin@vcbneo.vn' },
  { username: 'operator', password: 'op123',    name: 'Trần Thị Vận hành', role: 'Operator', email: 'operator@vcbneo.vn' },
  { username: 'viewer',   password: 'view123',  name: 'Lê Văn Xem',        role: 'Viewer',   email: 'viewer@vcbneo.vn' },
]

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('vcbneo_user')) ?? null }
    catch { return null }
  })

  const login = (username, password) => {
    const found = MOCK_USERS.find(u => u.username === username && u.password === password)
    if (!found) return false
    const u = { name: found.name, role: found.role, email: found.email, username: found.username }
    sessionStorage.setItem('vcbneo_user', JSON.stringify(u))
    setUser(u)
    return true
  }

  const logout = () => {
    sessionStorage.removeItem('vcbneo_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
