import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        globals: true,
        // Never run the duplicated test copies emitted into the standalone build output —
        // they fail on a broken bundled react and are not the source-of-truth tests.
        exclude: ["**/node_modules/**", "**/.next/**"],
    },
});
