import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
  server: {
    proxy: {
      '/process-audio': 'http://localhost:8000',
      '/process-demo': 'http://localhost:8000',
      '/detect-language': 'http://localhost:8000',
    }
  }
})
