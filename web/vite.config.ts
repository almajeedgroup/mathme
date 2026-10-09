/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

// The app calls its servers under /api.
// - With ACCOUNT_SERVICE_URL (the account service, e.g. http://localhost:8787), all of /api goes there;
//   it forwards geometry jobs to the geometry service itself, like the deployed Cloudflare Worker.
// - Otherwise /api goes straight to the Python geometry service on :8000 (no accounts).
const GEOMETRY_SERVICE_URL = process.env.GEOMETRY_SERVICE_URL ?? 'http://localhost:8000';
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL;

const proxy = {
  '/api': ACCOUNT_SERVICE_URL
    ? { target: ACCOUNT_SERVICE_URL, changeOrigin: false }
    : {
        target: GEOMETRY_SERVICE_URL,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ''),
      },
};

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  // shared/plans.json lives one folder up, next to the account service
  server: { host: true, proxy, fs: { allow: ['..'] } },
  preview: { proxy },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      // The studio app, its landing page and the policy pages Cashfree asks for.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        landing: resolve(import.meta.dirname, 'landing/index.html'),
        terms: resolve(import.meta.dirname, 'landing/terms.html'),
        privacy: resolve(import.meta.dirname, 'landing/privacy.html'),
        refunds: resolve(import.meta.dirname, 'landing/refunds.html'),
        contact: resolve(import.meta.dirname, 'landing/contact.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
