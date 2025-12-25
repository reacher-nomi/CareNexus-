import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/CareNexus-/',  // ← ADD THIS LINE (replace with your actual repo name)
  plugins: [react()],
})