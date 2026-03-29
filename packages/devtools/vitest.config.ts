import { defineConfig } from 'vitest/config';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  test: {
    name: packageJson.name,
    watch: false,
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
