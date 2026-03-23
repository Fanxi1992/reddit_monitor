import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 本地开发时，前端默认通过相对路径访问：
// - /api -> FastAPI
// - /static -> FastAPI 静态文件
// 因此需要在 Vite dev server 下显式代理到后端端口。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/static': {
          target: devProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
