import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

const phoneSsl = process.env['PHONE_SSL'] === '1';

export default defineConfig({
  base: process.env['PAGES_BASE'] ?? '/',
  build: { outDir: 'dist', sourcemap: true, manifest: true },
  plugins: phoneSsl ? [basicSsl()] : [],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: phoneSsl ? {} : undefined,
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/gestures/**', 'src/filters/**', 'src/vision/**'],
    },
  },
});
