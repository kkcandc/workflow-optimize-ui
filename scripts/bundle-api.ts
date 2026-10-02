import { build } from "esbuild";

await build({
  entryPoints: ["server/analyze.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "api/analyze.js",
  target: "node22",
  legalComments: "none",
});
