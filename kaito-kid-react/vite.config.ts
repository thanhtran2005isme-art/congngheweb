import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all interfaces
    port: 5173,
    strictPort: true,
    // Chỉ whitelist các hostname public thực sự dùng qua Cloudflare Tunnel.
    // Không dùng allowedHosts: true để tránh mở dev server cho Host header tùy ý.
    allowedHosts: ['kaitokid.io.vn', 'www.kaitokid.io.vn'],
    // Không hard-code HMR về kaitokid.io.vn.
    // Localhost vẫn dùng ws://localhost:5173; qua HTTPS tunnel Vite sẽ tự dùng host hiện tại.
  },
})
