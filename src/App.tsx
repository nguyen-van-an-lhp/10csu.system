import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SeatingChart from './pages/SeatingChart'
import Reports from './pages/Reports'
import Mentor from './pages/Mentor'
import Rules from './pages/Rules'
import Conduct from './pages/Conduct'
import Accounts from './pages/Accounts'
import CatalogEditor from './pages/CatalogEditor'
import ConductReport from './pages/ConductReport'
import BCSStats from './pages/BCSStats'
import Learning from './pages/Learning'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            {/* Bọc ErrorBoundary quanh toàn bộ Routes — trước đây một lỗi
                runtime bất kỳ ở BẤT KỲ trang nào (thiếu field dữ liệu, hàm
                gọi sai...) khiến React unmount toàn bộ ứng dụng, hiển thị
                trang trắng hoàn toàn không có manh mối nào để chẩn đoán. */}
            <ErrorBoundary>
              <Routes>
                <Route path="/"               element={<Login />} />
                <Route path="/dashboard"      element={<Dashboard />} />
                <Route path="/learning"       element={<Learning />} />
                <Route path="/announcements"  element={<Navigate to="/dashboard" replace />} />
                <Route path="/timeline"       element={<Navigate to="/dashboard" replace />} />
                <Route path="/mentor"         element={<Mentor />} />
                <Route path="/seating"        element={<SeatingChart />} />
                <Route path="/reports"        element={<Reports />} />
                <Route path="/rules"          element={<Rules />} />
                <Route path="/conduct"        element={<Conduct />} />
                <Route path="/accounts"       element={<Accounts />} />
                <Route path="/catalog"        element={<CatalogEditor />} />
                <Route path="/conduct-report" element={<ConductReport />} />
                <Route path="/bcs-stats"      element={<BCSStats />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  )
}