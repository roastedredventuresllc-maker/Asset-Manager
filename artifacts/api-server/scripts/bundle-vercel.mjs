import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Vercel Express services file-trace from the service root. pnpm puts
 * express (and most deps) in the repo-root store via symlinks, so the
 * lambda boots with missing modules and returns FUNCTION_INVOCATION_FAILED
 * even for a 10-line healthz app. Bundle JS into server.cjs so healthz does
 * not resolve node_modules at invoke time. Native addons stay external.
 *
 * sharp must be copied (dereferenced) into this service: includeFiles
 * `node_modules/sharp/**` does not follow pnpm store symlinks outside
 * artifacts/api-server, so Craft lock / composite never loaded on Vercel.
 */
const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

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
  external: ["sharp", "*.node", "pg-native", "@vercel/functions"],
  footer: {
    js: "module.exports = module.exports.default || module.exports;",
  },
});

vendorSharp();

function vendorSharp() {
  const sharpPkg = path.dirname(require.resolve("sharp/package.json"));
  const dest = path.join(serviceRoot, "node_modules", "sharp");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(sharpPkg, dest, { recursive: true, dereference: true });

  const nested = path.join(dest, "node_modules");
  fs.mkdirSync(nested, { recursive: true });

  const imgSrc = path.join(path.dirname(sharpPkg), "@img");
  if (fs.existsSync(imgSrc)) {
    fs.cpSync(imgSrc, path.join(nested, "@img"), {
      recursive: true,
      dereference: true,
    });
  }

  for (const dep of ["detect-libc", "semver"]) {
    try {
      const depRoot = path.dirname(require.resolve(`${dep}/package.json`));
      fs.cpSync(depRoot, path.join(nested, dep), {
        recursive: true,
        dereference: true,
      });
    } catch {
      // optional: sharp's own nested tree may already resolve these
    }
  }

  const nativeMarker = path.join(nested, "@img", "sharp-linux-x64", "package.json");
  if (!fs.existsSync(nativeMarker)) {
    console.warn("vendor-sharp: @img/sharp-linux-x64 missing after copy");
  } else {
    console.log("vendor-sharp: copied sharp + linux-x64 into service node_modules");
  }

  try {
    const loaded = require(dest);
    const factory =
      typeof loaded === "function"
        ? loaded
        : typeof loaded?.default === "function"
          ? loaded.default
          : typeof loaded?.default?.default === "function"
            ? loaded.default.default
            : null;
    if (typeof factory !== "function") {
      console.warn("vendor-sharp: required module is not callable; runtime loadSharp will unwrap");
    } else {
      console.log("vendor-sharp: require('sharp') is callable");
    }
  } catch (err) {
    console.warn(
      "vendor-sharp: require at build time skipped",
      err instanceof Error ? err.message : err,
    );
  }
}
