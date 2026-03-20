import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import RegisterPost from './pages/RegisterPost'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3200,
          style: {
            borderRadius: '18px',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            background: 'rgba(255, 255, 255, 0.96)',
            color: '#0f172a',
            boxShadow: '0 18px 60px rgba(15, 23, 42, 0.12)',
          },
        }}
      />

      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/register" replace />} />
          <Route path="/register" element={<RegisterPost />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/register" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
