import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { homeRoute } from './config/permissions'
import Layout         from './components/Layout'
import ToastContainer from './components/Toast'
import ConfirmDialog  from './components/ConfirmDialog'
import DesignReference from './pages/DesignReference'
import Login          from './pages/Login'
import FileTypeSettings from './pages/FileTypeSettings'
import DataInput        from './pages/DataInput'
import DataStorage      from './pages/DataStorage'
import JoinLogic        from './pages/JoinLogic'
import Reconcile        from './pages/Reconcile'
import MasterSummary    from './pages/MasterSummary'
import Reports          from './pages/Reports'
import AppSettings      from './pages/AppSettings'
import SwiftCore        from './pages/SwiftCore'
import NapasCore        from './pages/NapasCore'
import CoreSummary      from './pages/CoreSummary'
import DateRules        from './pages/DateRules'
import Chatbot          from './pages/Chatbot'
import Dashboard        from './pages/Dashboard'

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireRole({ roles, children }) {
  const { user } = useAuth()
  if (!roles.includes(user?.role)) return <Navigate to={homeRoute(user?.role)} replace />
  return children
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homeRoute(user?.role)} replace />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/design-reference" element={<DesignReference />} />
        <Route path="/login" element={<Login />} />

        <Route path="/*" element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/"              element={<HomeRedirect />} />
                <Route path="/dashboard"     element={<Dashboard />} />
                <Route path="/file-settings" element={<RequireRole roles={['Admin']}><FileTypeSettings /></RequireRole>} />
                <Route path="/data-input"    element={<RequireRole roles={['Admin', 'Operator']}><DataInput /></RequireRole>} />
                <Route path="/storage"       element={<DataStorage />} />
                <Route path="/join-logic"    element={<RequireRole roles={['Admin', 'Operator']}><JoinLogic /></RequireRole>} />
                <Route path="/reconcile"     element={<Reconcile />} />
                <Route path="/swift-core"    element={<SwiftCore />} />
                <Route path="/napas-core"    element={<NapasCore />} />
                <Route path="/core-summary"  element={<CoreSummary />} />
                <Route path="/date-rules"    element={<DateRules />} />
                <Route path="/master"        element={<MasterSummary />} />
                <Route path="/reports"       element={<Reports />} />
                <Route path="/chatbot"       element={<Chatbot />} />
                <Route path="/settings"      element={<RequireRole roles={['Admin']}><AppSettings /></RequireRole>} />
              </Routes>
            </Layout>
          </RequireAuth>
        } />
      </Routes>

      <ToastContainer />
      <ConfirmDialog />
    </>
  )
}
