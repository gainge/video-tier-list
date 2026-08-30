import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Served from a GitHub Pages project path, so assets must resolve under the repo name.
export default defineConfig({
  base: '/video-tier-list/',
  plugins: [react()],
  // Vite's native file watching does not fire for a repo living on a Windows mount
  // under WSL, which silently serves stale modules; polling is the only reliable option.
  server: { watch: { usePolling: true } },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
