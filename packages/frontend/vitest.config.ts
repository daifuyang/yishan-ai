import { defineConfig } from 'vitest';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/lib/__tests__/**/*.test.ts'],
  },
});