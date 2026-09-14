import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    target: "es2022",
    platform: "neutral",
    dts: true,
    clean: true,
    sourcemap: false,
    treeshake: true,
    splitting: false,
    outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "es2022",
    platform: "node",
    dts: false,
    clean: false,
    sourcemap: false,
    treeshake: true,
    splitting: false,
    banner: { js: "#!/usr/bin/env node" },
    outExtension: () => ({ js: ".js" }),
  },
]);
