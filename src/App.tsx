import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { ToastProvider } from './contexts/ToastContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SeatingChart from './pages/SeatingChart'
import Reports from './pages/Reports'
import Mentor from './pages/Mentor'
import Rules from './pages/Rules'
import Conduct from './pages/Conduct'
import Accounts from './pages/Accounts'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
               <Route path="/" element={<Login />} />
               <Route path="/dashboard" element={<Dashboard />} />
               {/* Tổng quan / Thông báo / Lịch trình đã gộp vào /dashboard — giữ 2 route
                   cũ dưới dạng chuyển hướng để không vỡ đường link/bookmark đã lưu. */}
               <Route path="/announcements" element={<Navigate to="/dashboard" replace />} />
               <Route path="/timeline" element={<Navigate to="/dashboard" replace />} />
               <Route path="/mentor" element={<Mentor />} />
               <Route path="/seating" element={<SeatingChart />} />
               <Route path="/reports" element={<Reports />} />
               <Route path="/rules" element={<Rules />} />
               <Route path="/conduct" element={<Conduct />} />
               <Route path="/accounts" element={<Accounts />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  )
}