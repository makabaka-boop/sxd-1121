import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8821,
    proxy: {
      '/api': {
        target: 'http://localhost:8021',
        changeOrigin: true,
      },
    },
  },
});
