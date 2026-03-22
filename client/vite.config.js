import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Firefox + Vite: "disallowed MIME type" on /src/*.css often comes from HMR
 * fetching the wrong host (localhost vs 127.0.0.1 / IPv6), partial transfers,
 * or strict paths. Listen on all interfaces and allow parent fs for monorepo-style paths.
 * If problems persist, move the project to a path without spaces/parentheses.
 */
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  css: {
    devSourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    fs: {
      allow: [__dirname, path.resolve(__dirname, '..')],
    },
    watch: {
      usePolling: process.env.VITE_POLL === '1',
    },
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:5000', ws: true },
    },
  },
});
