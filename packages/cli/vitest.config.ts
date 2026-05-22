import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@deepcode/tui-shim": path.resolve("./src/tui/qwen-core/index.ts"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
