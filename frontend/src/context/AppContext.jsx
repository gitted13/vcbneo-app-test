import { createContext, useContext, useState, useCallback } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [toasts, setToasts]   = useState([])
  const [confirm, setConfirm] = useState(null)

  const toast = useCallback((msg, variant = 'success', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, variant }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const showConfirm  = useCallback((opts) => setConfirm(opts), [])
  const closeConfirm = () => setConfirm(null)

  return (
    <AppContext.Provider value={{ toast, toasts, setToasts, confirm, showConfirm, closeConfirm }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
