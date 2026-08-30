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
  banner: {
    js: `var import_meta_url = require("node:url").pathToFileURL(__filename).href;`,
  },
  define: {
    "import.meta.url": "import_meta_url",
  },
  footer: {
    js: "module.exports = module.exports.default || module.exports;",
  },
});

vendorSharp();
await assertVendoredSharpCallable();

function vendorSharp() {
  const dest = path.join(serviceRoot, "node_modules", "sharp");
  const repoSharp = path.resolve(serviceRoot, "../../node_modules/sharp");
  const resolved = fs.existsSync(path.join(repoSharp, "package.json"))
    ? repoSharp
    : path.dirname(require.resolve("sharp/package.json"));
  if (path.resolve(resolved) === path.resolve(dest)) {
    throw new Error(
      "vendor-sharp: refuse to copy sharp onto itself (ENOENT after rm). Resolve from repo-root node_modules/sharp.",
    );
  }

  // Copy into a sibling first. rm+cp on dest after a prior vendor made
  // require("sharp") === dest and stat'd a deleted tree (ENOENT cache race).
  const staging = `${dest}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(resolved, staging, { recursive: true, dereference: true });
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(staging, dest);

  const nested = path.join(dest, "node_modules");
  fs.mkdirSync(nested, { recursive: true });

  const imgCandidates = [
    path.join(path.dirname(resolved), "@img"),
    path.resolve(serviceRoot, "../../node_modules/@img"),
  ];
  for (const imgSrc of imgCandidates) {
    if (!fs.existsSync(imgSrc)) continue;
    fs.cpSync(imgSrc, path.join(nested, "@img"), {
      recursive: true,
      dereference: true,
    });
    break;
  }

  for (const dep of ["detect-libc", "semver"]) {
    try {
      const depRoot = path.dirname(require.resolve(`${dep}/package.json`));
      if (path.resolve(depRoot) === path.join(nested, dep)) continue;
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
}

/**
 * File existence is not enough — production died with
 * `TypeError: sharp is not a function` inside rejectIfFlatGradient.
 * Fail the Vercel build if the vendored module is not callable.
 */
async function assertVendoredSharpCallable() {
  const req = createRequire(path.join(serviceRoot, "server.cjs"));
  const raw = req("sharp");
  let sharp = raw;
  for (let i = 0; i < 4 && typeof sharp !== "function"; i++) {
    sharp = sharp && typeof sharp === "object" ? sharp.default : undefined;
  }
  if (typeof sharp !== "function") {
    throw new Error(
      `vendored sharp is not a function (got ${typeof sharp}). Craft lock would reject Imagine plates.`,
    );
  }
  const buf = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#336699" },
  })
    .png()
    .toBuffer();
  if (!buf || buf[0] !== 0x89) {
    throw new Error("vendored sharp() did not produce a PNG");
  }
  const stats = await sharp(buf).stats();
  if (!stats?.channels?.length) {
    throw new Error("vendored sharp().stats() failed — rejectIfFlatGradient would throw");
  }
  console.log("vendor-sharp: sharp() is a function and produced a PNG");
}
