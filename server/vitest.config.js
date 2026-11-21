import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      // Tests use their own database so they never touch your real data.
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgres://factoryflow:factoryflow@localhost:5432/factoryflow_test',
    },
    fileParallelism: false, // test files share one database, so run them one at a time
    hookTimeout: 20000,
  },
});
