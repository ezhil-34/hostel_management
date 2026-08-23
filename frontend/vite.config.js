import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Inside docker compose the services are reachable by their compose names.
  // Running `npm run dev` on your host, they are on localhost.
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:5000'
  const maintenanceTarget = env.VITE_MAINTENANCE_PROXY_TARGET || 'http://localhost:5100'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      // Bind mounts on Windows/macOS do not emit inotify events reliably.
      watch: { usePolling: env.CHOKIDAR_USEPOLLING === 'true' },
      // This is the dev gateway. The browser only ever sees "/api" — path
      // routing here is what hides the fact that two services are answering.
      // Order matters: Vite matches in insertion order, so the more specific
      // "/api/maintenance" must come first or the general rule swallows it.
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
