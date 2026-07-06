import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build also works served from a subpath
  // (the backend will mount it at /widget in a later module).
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8710', ws: true },
      '/api': { target: 'http://127.0.0.1:8710' },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
