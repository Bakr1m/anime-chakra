import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  build: { outDir: 'dist', sourcemap: true },
  server: { host: '0.0.0.0', port: 5173 },
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
