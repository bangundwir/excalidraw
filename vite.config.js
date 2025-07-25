
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['vite.dwx.my.id'], // ✅ Izinkan host ini
  },
  define: {
    'process.env': {},
  },
})
