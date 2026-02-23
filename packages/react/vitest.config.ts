import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@connectivity-js/core': `${import.meta.dirname}/../core/src/index.ts`,
    },
  },
  test: {
    name: packageJson.name,
    watch: false,
    environment: 'happy-dom',
    setupFiles: ['./tests/test-setup.ts'],
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    typecheck: {
      enabled: true,
      include: ['tests/**/*.test-d.{ts,tsx}'],
    },
  },
});
