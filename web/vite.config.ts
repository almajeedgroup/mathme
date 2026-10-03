/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Python geometry service runs on :8000 in development; the app calls it via /api.
const GEOMETRY_SERVICE_URL = process.env.GEOMETRY_SERVICE_URL ?? 'http://localhost:8000';

const proxy = {
  '/api': {
    target: GEOMETRY_SERVICE_URL,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { host: true, proxy },
  preview: { proxy },
  build: {
    chunkSizeWarningLimit: 2500,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
