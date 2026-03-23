import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ModulePlaceholder from './pages/ModulePlaceholder'
import PostArchive from './pages/PostArchive'
import PostEntry from './pages/PostEntry'
import PostManagement from './pages/PostManagement'
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
          <Route index element={<Navigate to="/post-management" replace />} />
          <Route
            path="/post-management"
            element={<PostManagement />}
          />
          <Route
            path="/post-entry"
            element={<PostEntry />}
          />
          <Route
            path="/post-archive"
            element={<PostArchive />}
          />
          <Route
            path="/post-retention"
            element={
              <ModulePlaceholder
                eyebrow="Screenshot Archive"
                title="帖子留存"
                description="这里将承接截图留存与打钱凭证管理。后续会集中展示第 0 / 1 / 2 / 4 / 7 天的截图结果，支持筛选、预览与交付。"
              />
            }
          />
          <Route path="/register" element={<RegisterPost />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/post-management" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
