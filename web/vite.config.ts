import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

const phoneSsl = process.env['PHONE_SSL'] === '1';

// visible build stamp (HUD + e2e): proves which build a phone actually runs.
// Critical for flip/mirror reports: stale service-worker caches are the
// usual suspect, and the stamp distinguishes them from real bugs.
const buildId =
  process.env['GITHUB_SHA']?.slice(0, 7) ?? `local-${new Date().toISOString().slice(0, 10)}`;

export default defineConfig({
  base: process.env['PAGES_BASE'] ?? '/',
  build: { outDir: 'dist', sourcemap: true, manifest: true },
  define: { __BUILD_ID__: JSON.stringify(buildId) },
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
