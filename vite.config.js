import { defineConfig } from 'vite';

// Todas las llamadas a /api se envían a la API local (FastAPI) en el mismo equipo.
export default defineConfig({
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  preview: {
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
});
