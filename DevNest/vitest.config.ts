import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    globals: false,
    // node by default; component test files override per-file with
    // `// @vitest-environment jsdom` so the DOM is only spun up where
    // it's actually needed.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/**/route.ts", "components/**/*.tsx"],
      reporter: ["text", "html"],
    },
  },
});
