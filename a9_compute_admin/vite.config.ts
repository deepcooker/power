import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/compute/',
  server: {
    host: '127.0.0.1',
    port: 6111,
    proxy: {
      '/api': 'http://127.0.0.1:6111'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
