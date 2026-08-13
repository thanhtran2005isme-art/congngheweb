import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all interfaces
    port: 5173,
    strictPort: true,
    // Không hard-code HMR về kaitokid.io.vn.
    // Khi chạy localhost, Vite sẽ tự dùng ws://localhost:5173.
  },
})
