import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Vercel Express services file-trace from the service root. pnpm puts
 * express (and most deps) in the repo-root store via symlinks, so the
 * lambda boots with missing modules and returns FUNCTION_INVOCATION_FAILED
 * even for a 10-line healthz app. Bundle JS into server.cjs so healthz does
 * not resolve node_modules at invoke time. Native addons stay external.
 */
const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  absWorkingDir: serviceRoot,
  entryPoints: [path.join(serviceRoot, "src/app.ts")],
  outfile: path.join(serviceRoot, "server.cjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  logLevel: "info",
  sourcemap: false,
  legalComments: "none",
  packages: "bundle",
  external: ["sharp", "*.node", "pg-native"],
  footer: {
    js: "module.exports = module.exports.default || module.exports;",
  },
});
