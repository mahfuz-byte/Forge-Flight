import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (mode === 'production' && (process.env.VERCEL || process.env.RENDER) && !/^https:\/\/[^/]+\/api$/.test(env.VITE_API_URL || '')) {
    throw new Error('Set VITE_API_URL to the Render HTTPS API URL before building.')
  }
  return { plugins: [react()] }
})
