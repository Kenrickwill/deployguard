import { defineConfig } from "tsup";

export default defineConfig({
  entry:  ["src/index.ts"],
  format: ["cjs"],
  target: "node18",
  outDir: "dist",
  clean:  true,
  banner: { js: "#!/usr/bin/env node" },
  // Bundle all dependencies so the CLI is a single portable file
  noExternal: [/.*/],
});
