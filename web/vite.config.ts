/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Python geometry service runs on :8000 in development; the app calls it via /api.
const GEOMETRY_SERVICE_URL = process.env.GEOMETRY_SERVICE_URL ?? 'http://localhost:8000';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: GEOMETRY_SERVICE_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
