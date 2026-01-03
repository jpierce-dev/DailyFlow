import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { defineEnv } from './env'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': process.env
  }
})

// Helper to shim process.env if needed in browser
function defineEnv() {
  const env: Record<string, string> = {};
  for (const key in process.env) {
    env[`process.env.${key}`] = JSON.stringify(process.env[key]);
  }
  return env;
}