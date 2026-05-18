import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import FileTypeSettings from './pages/FileTypeSettings'
import DataInput       from './pages/DataInput'
import History         from './pages/History'
import DataStorage     from './pages/DataStorage'
import JoinLogic       from './pages/JoinLogic'
import Reports         from './pages/Reports'
import AppSettings     from './pages/AppSettings'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"              element={<Navigate to="/file-settings" replace />} />
        <Route path="/file-settings" element={<FileTypeSettings />} />
        <Route path="/data-input"    element={<DataInput />} />
        <Route path="/history"       element={<History />} />
        <Route path="/storage"       element={<DataStorage />} />
        <Route path="/join-logic"    element={<JoinLogic />} />
        <Route path="/reports"       element={<Reports />} />
        <Route path="/settings"      element={<AppSettings />} />
      </Routes>
    </Layout>
  )
}
