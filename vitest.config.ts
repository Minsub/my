import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://daily:local-development-only@127.0.0.1:54329/daily_test",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "integration-test-secret-32-characters-long-only",
      OWNER_EMAIL: "owner@test.example",
      LOCAL_PASSWORD_AUTH: "true",
      HOUSEHOLD_NAME: "테스트 가족",
    },
  },
});
