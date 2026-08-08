/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Styling is verified in the browser, not here; skipping CSS keeps the
    // suite fast and stops jsdom choking on the CSS-module imports.
    css: false,
  },
})
