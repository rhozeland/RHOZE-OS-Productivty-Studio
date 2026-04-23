import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // `*.integration.test.ts` files are part of this glob too — but each
    // such file env-gates itself with `describe.skip` so they no-op
    // unless RUN_FLOW_RLS_INTEGRATION=1 (and the required keys) are set.
    // See `src/test/integration/README.md`.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "src/**/*.integration.test.ts",
    ],
    // Integration suites talk to a real backend — give them more headroom.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
