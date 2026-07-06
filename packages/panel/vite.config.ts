import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5174,
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
