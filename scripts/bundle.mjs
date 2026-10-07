// Bundles the MCP server into a single self-contained dist/index.js so the
// plugin runs straight from a git checkout (Claude Cowork does not run
// `npm install`, so node_modules is never present there).
import { build } from "esbuild";
import { rm } from "fs/promises";

await rm("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  legalComments: "none",
  // Some bundled deps are CommonJS and call require() on Node builtins.
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
});
