import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/user': 'http://localhost:8080',
      '/wallet': 'http://localhost:8080',
      '/transaction': 'http://localhost:8080',
      '/qr': 'http://localhost:8080',
      '/rewards': 'http://localhost:8080',
      '/otp': 'http://localhost:8080',
      '/referral': 'http://localhost:8080',
      '/bank': 'http://localhost:8080',
    }
  },
  build: {
    outDir: 'dist',
  }
})
