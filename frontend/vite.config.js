import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const proxyTarget =
    env.VITE_PROXY_TARGET || 'http://localhost:5000'

  const maintenanceTarget =
    env.VITE_MAINTENANCE_PROXY_TARGET ||
    'http://localhost:5100'

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,

      watch: {
        usePolling:
          env.CHOKIDAR_USEPOLLING === 'true',
      },

      proxy: {
        '/api/maintenance': {
          target: maintenanceTarget,
          changeOrigin: true,
        },

        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },

    preview: {
      host: '0.0.0.0',
      port: 4173,
    },
  }
})