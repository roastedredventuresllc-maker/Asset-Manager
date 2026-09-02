import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

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
 *
 * Preview Adr5gGS7: sharp.js `require('detect-libc')` died MODULE_NOT_FOUND
 * because detect-libc lived only under sharp/node_modules (or the build
 * machine's repo-root hoist). includeFiles `{node_modules/sharp/**}` does
 * not ship that. Copy detect-libc, semver, and @img as siblings of sharp
 * so /var/task/node_modules/detect-libc resolves, and fail the build
 * unless an isolated lambda layout can require them.
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
    js: `var import_meta_url = require("node:url").pathToFileURL(__filename).href;
var __launchpadSharp = require("./sharp-fn.cjs");
if (typeof globalThis === "object") globalThis.__launchpadSharp = __launchpadSharp;`,
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
await assertCompositeInterNotTofu();

function resolvePackageRoot(name, fromRequire = require) {
  try {
    return path.dirname(fromRequire.resolve(`${name}/package.json`));
  } catch {
    const fallbacks = [
      path.resolve(serviceRoot, "../../node_modules", name),
      path.join(serviceRoot, "node_modules", name),
    ];
    const found = fallbacks.find((p) => fs.existsSync(path.join(p, "package.json")));
    if (found) return found;
    throw new Error(
      `vendor-sharp: cannot resolve ${name}. Lambda sharp.js would throw MODULE_NOT_FOUND.`,
    );
  }
}

function copyTree(src, dest) {
  if (path.resolve(src) === path.resolve(dest)) return;
  const staging = `${dest}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, staging, { recursive: true, dereference: true });
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(staging, dest);
}

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

  copyTree(resolved, dest);

  const siblingNm = path.join(serviceRoot, "node_modules");
  const nestedNm = path.join(dest, "node_modules");
  fs.mkdirSync(nestedNm, { recursive: true });

  // Resolve deps the way sharp.js does. Repo-root hoist can be semver@6
  // (no functions/coerce) — that is what Adr5gGS7-class misses look like.
  const sharpRequire = createRequire(path.join(resolved, "package.json"));
  for (const dep of ["detect-libc", "semver"]) {
    const src = resolvePackageRoot(dep, sharpRequire);
    if (dep === "semver" && !fs.existsSync(path.join(src, "functions", "coerce.js"))) {
      throw new Error(
        `vendor-sharp: ${src} is not sharp's semver (missing functions/coerce)`,
      );
    }
    copyTree(src, path.join(siblingNm, dep));
    copyTree(src, path.join(nestedNm, dep));
  }

  const imgCandidates = [
    path.join(path.dirname(resolved), "@img"),
    path.resolve(serviceRoot, "../../node_modules/@img"),
  ];
  const imgSrc = imgCandidates.find((p) => fs.existsSync(p));
  if (!imgSrc) {
    throw new Error("vendor-sharp: @img (linux native + libvips) missing");
  }
  copyTree(imgSrc, path.join(siblingNm, "@img"));
  copyTree(imgSrc, path.join(nestedNm, "@img"));

  const mustExist = [
    path.join(siblingNm, "detect-libc", "package.json"),
    path.join(siblingNm, "@img", "sharp-linux-x64", "package.json"),
    path.join(dest, "package.json"),
  ];
  for (const marker of mustExist) {
    if (!fs.existsSync(marker)) {
      throw new Error(`vendor-sharp: staged lambda missing ${marker}`);
    }
  }
  console.log("vendor-sharp: copied sharp + detect-libc + @img into service node_modules");
}

/**
 * Build-machine require("sharp") can walk up to repo-root node_modules and
 * hide a missing detect-libc. Assert against a temp layout that only has
 * the files includeFiles will ship to /var/task.
 */
async function assertVendoredSharpCallable() {
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "lp-lambda-"));
  try {
    fs.copyFileSync(path.join(serviceRoot, "server.cjs"), path.join(isolated, "server.cjs"));
    fs.copyFileSync(path.join(serviceRoot, "sharp-fn.cjs"), path.join(isolated, "sharp-fn.cjs"));
    const nm = path.join(isolated, "node_modules");
    fs.mkdirSync(nm, { recursive: true });
    for (const name of ["sharp", "detect-libc", "semver", "@img"]) {
      const src = path.join(serviceRoot, "node_modules", name);
      if (!fs.existsSync(src)) {
        throw new Error(
          `staged lambda missing node_modules/${name} — includeFiles would omit it and sharp.js would MODULE_NOT_FOUND`,
        );
      }
      fs.cpSync(src, path.join(nm, name), { recursive: true, dereference: true });
    }

    const req = createRequire(path.join(isolated, "server.cjs"));
    let libc;
    try {
      libc = req("detect-libc");
    } catch (err) {
      throw new Error(
        `require("detect-libc") failed from staged lambda layout: ${err instanceof Error ? err.message : err}`,
      );
    }
    if (typeof libc.familySync !== "function") {
      throw new Error("require('detect-libc') from staged lambda is not the CJS API");
    }
    const libcPath = req.resolve("detect-libc");
    if (!libcPath.startsWith(isolated)) {
      throw new Error(
        `detect-libc resolved outside staged lambda (${libcPath}) — build-machine hoist would hide the Adr5gGS7 miss`,
      );
    }
    const coercePath = req.resolve("semver/functions/coerce");
    if (!coercePath.startsWith(isolated)) {
      throw new Error(`semver/functions/coerce resolved outside staged lambda (${coercePath})`);
    }

    const fromShim = req("./sharp-fn.cjs");
    if (typeof fromShim !== "function") {
      throw new Error(
        `sharp-fn.cjs did not export a function (got ${typeof fromShim}). Craft lock would reject Imagine plates.`,
      );
    }
    const fromDirect = req("sharp");
    if (typeof fromDirect !== "function") {
      throw new Error(
        `require("sharp") is not a function (got ${typeof fromDirect}). Do not use the ESM namespace in the lambda.`,
      );
    }
    const buf = await fromShim({
      create: { width: 8, height: 8, channels: 3, background: "#336699" },
    })
      .png()
      .toBuffer();
    if (!buf || buf[0] !== 0x89) {
      throw new Error("vendored sharp() did not produce a PNG");
    }
    const stats = await fromShim(buf).stats();
    if (!stats?.channels?.length) {
      throw new Error("vendored sharp().stats() failed — rejectIfFlatGradient would throw");
    }
  } finally {
    fs.rmSync(isolated, { recursive: true, force: true });
  }

  const bundled = fs.readFileSync(path.join(serviceRoot, "server.cjs"), "utf8");
  if (!bundled.includes('require("./sharp-fn.cjs")')) {
    throw new Error(
      "server.cjs does not require(\"./sharp-fn.cjs\") — lambda would import the ESM namespace again",
    );
  }
  if (bundled.includes('import("sharp")') || bundled.includes("import('sharp')")) {
    throw new Error("server.cjs still dynamic-imports sharp — Craft would get an object");
  }
  console.log(
    "vendor-sharp: require('detect-libc') + sharp() work from staged lambda layout (not repo-root hoist)",
  );
}

/**
 * Preview E9Aeksku burned Inter/Times as tofu — the lambda had no glyphs.
 * Fail the build if a known string still composites to hollow boxes.
 */
async function assertCompositeInterNotTofu() {
  const regular = path.join(serviceRoot, "fonts", "Inter-Regular.ttf");
  const bold = path.join(serviceRoot, "fonts", "Inter-Bold.ttf");
  if (!fs.existsSync(regular) || !fs.existsSync(bold)) {
    throw new Error(
      "fonts/Inter-Regular.ttf and Inter-Bold.ttf must ship next to sharp. Composite would tofu.",
    );
  }
  const req = createRequire(path.join(serviceRoot, "server.cjs"));
  const sharp = req("./sharp-fn.cjs");
  if (typeof sharp !== "function") {
    throw new Error("sharp() not callable while asserting Inter composite");
  }
  const regularB64 = fs.readFileSync(regular).toString("base64");
  const boldB64 = fs.readFileSync(bold).toString("base64");
  const face = `
@font-face { font-family: "LaunchPadInter"; font-weight: 400; src: url("${pathToFileURL(regular).href}") format("truetype"), url("data:font/ttf;base64,${regularB64}") format("truetype"); }
@font-face { font-family: "LaunchPadInter"; font-weight: 700; src: url("${pathToFileURL(bold).href}") format("truetype"), url("data:font/ttf;base64,${boldB64}") format("truetype"); }
`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">
  <defs><style type="text/css">${face}</style></defs>
  <rect width="400" height="200" fill="#111111"/>
  <text x="200" y="80" text-anchor="middle" font-family="LaunchPadInter" font-size="42" fill="white" font-weight="400">WAKE UP</text>
  <text x="200" y="150" text-anchor="middle" font-family="LaunchPadInter" font-size="16" fill="white" font-weight="700">Get yours</text>
</svg>`);
  const png = await sharp(svg).png().toBuffer();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 3;
    if ((data[o] ?? 0) + (data[o + 1] ?? 0) + (data[o + 2] ?? 0) > 480) ink++;
  }
  if (ink < 800) {
    throw new Error(
      `Inter composite of "WAKE UP" painted ${ink} ink pixels — tofu / missing glyphs`,
    );
  }
  console.log(`vendor-fonts: Inter Regular+Bold composited "WAKE UP" (${ink} ink px)`);
}
