import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing vendor libs into their own chunks so they stay
        // cached across app deploys (better repeat-visit load). recharts is left
        // alone — it is already isolated in the lazy AnalyticsPage chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('@sentry')) return 'vendor-sentry'
          if (id.includes('react-router')) return 'vendor-router'
        },
      },
    },
  },
})
