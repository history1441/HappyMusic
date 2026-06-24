import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, '../common/src'),
    },
  },
  server: {
    port: 3721,
    proxy: {
      '/api': {
        target: 'http://localhost:9527',
        changeOrigin: true,
      },
    },
  },
})
