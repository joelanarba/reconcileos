import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], globals: true, include: ['tests/**/*.test.{ts,tsx}'] },
})
