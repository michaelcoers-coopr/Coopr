import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/mobile/test/**/*.test.ts'],
    environment: 'node',
    // Official Node builds can boot with --no-experimental-sqlite. The flag on the
    // worker turns the builtin back on so the schema tests have a database.
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--experimental-sqlite'],
      },
      threads: {
        execArgv: ['--experimental-sqlite'],
      },
    },
    server: {
      deps: {
        external: [/node:/],
      },
    },
  },
});
