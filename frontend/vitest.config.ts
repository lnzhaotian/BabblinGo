import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      // Map @ to project root for test imports
      "@": path.resolve(process.cwd(), "."),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
})
