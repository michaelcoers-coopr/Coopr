import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/mobile/test/**/*.test.ts'],
    environment: 'node',
    server: {
      deps: {
        external: [/node:/],
      },
    },
  },
});
