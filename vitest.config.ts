import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      include: ['src/services/posService.ts', 'src/services/customerService.ts', 'src/utils/permissions.ts'],
      reporter: ['text', 'html'],
    },
  },
});
