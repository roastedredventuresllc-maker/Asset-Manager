import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const COMPOSITE_FONT_FAMILY = "LaunchPadInter";

const FONT_FILES = {
  regular: "Inter-Regular.ttf",
  bold: "Inter-Bold.ttf",
} as const;

type FontsShim = { dir: string; resolve: (filename: string) => string };

let cachedFaceCss: string | null = null;

/**
 * Same layout the isolated /var/task assert copies: fonts-fn.cjs + fonts/
 * next to server.cjs. Do not walk the TypeScript source tree — that hid
 * the ALbkWDpm miss on the build machine.
 */
function requireFontsShim(): FontsShim | null {
  const injected = (globalThis as { __launchpadFonts?: FontsShim }).__launchpadFonts;
  if (injected && typeof injected.resolve === "function") return injected;

  const anchors: string[] = [];
  const bundled = (globalThis as { __filename?: string }).__filename;
  if (typeof bundled === "string" && bundled.length > 0) {
    anchors.push(bundled);
  }
  const meta = import.meta.url;
  if (typeof meta === "string" && meta.startsWith("file:")) {
    const here = fileURLToPath(meta);
    anchors.push(here);
    // Unbundled tests: this file lives in src/lib/. The lambda bundle
    // rewrites import.meta.url to server.cjs — do not walk ../../fonts
    // from that path (that hid ALbkWDpm).
    if (here.includes(`${path.sep}src${path.sep}lib${path.sep}`)) {
      anchors.push(path.join(here, "../../fonts-fn.cjs"));
    }
  }
  anchors.push(path.join(process.cwd(), "server.cjs"));
  anchors.push(path.join(process.cwd(), "fonts-fn.cjs"));
  anchors.push(path.join(process.cwd(), "package.json"));

  for (const anchor of anchors) {
    try {
      const req = createRequire(anchor);
      const shim = req("./fonts-fn.cjs") as FontsShim;
      if (shim && typeof shim.resolve === "function") return shim;
    } catch {
      // try the next anchor
    }
  }
  return null;
}

function candidateFontDirs(): string[] {
  const dirs: string[] = [];
  dirs.push(path.join(process.cwd(), "fonts"));
  const bundled = (globalThis as { __filename?: string }).__filename;
  if (typeof bundled === "string" && bundled.length > 0) {
    dirs.push(path.join(path.dirname(bundled), "fonts"));
  }
  const meta = import.meta.url;
  if (typeof meta === "string" && meta.startsWith("file:")) {
    const here = path.dirname(fileURLToPath(meta));
    dirs.push(path.join(here, "fonts"));
  }
  return dirs;
}

export function resolveCompositeFontFile(filename: string): string {
  const shim = requireFontsShim();
  if (shim) {
    try {
      return shim.resolve(filename);
    } catch {
      // fonts-fn.cjs present but TTF missing — try cwd/fonts before failing
    }
  }
  for (const dir of candidateFontDirs()) {
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) return full;
  }
  throw new Error(
    `LaunchPad Inter font missing (${filename}). Composite would burn tofu boxes.`,
  );
}

/** Point fontconfig at the vendored TTFs so librsvg can open the file paths. */
export function ensureCompositeFontconfig(): string {
  const fontsDir = path.dirname(resolveCompositeFontFile(FONT_FILES.regular));
  const confPath = path.join(os.tmpdir(), "launchpad-fonts.conf");
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${path.join(os.tmpdir(), "launchpad-fontconfig")}</cachedir>
</fontconfig>
`;
  fs.writeFileSync(confPath, conf);
  process.env.FONTCONFIG_FILE = confPath;
  return fontsDir;
}

/**
 * @font-face for the SVG overlay. file:// first (lambda path), then data URI
 * from the same TTF so librsvg still gets glyphs if fontconfig misses.
 * No Times. No system fonts. No CDN.
 */
export function compositeFontFaceCss(): string {
  if (cachedFaceCss) return cachedFaceCss;
  ensureCompositeFontconfig();
  const regular = resolveCompositeFontFile(FONT_FILES.regular);
  const bold = resolveCompositeFontFile(FONT_FILES.bold);
  const regularB64 = fs.readFileSync(regular).toString("base64");
  const boldB64 = fs.readFileSync(bold).toString("base64");
  cachedFaceCss = `
@font-face {
  font-family: "${COMPOSITE_FONT_FAMILY}";
  font-weight: 400;
  font-style: normal;
  src: url("${pathToFileURL(regular).href}") format("truetype"),
       url("data:font/ttf;base64,${regularB64}") format("truetype");
}
@font-face {
  font-family: "${COMPOSITE_FONT_FAMILY}";
  font-weight: 700;
  font-style: normal;
  src: url("${pathToFileURL(bold).href}") format("truetype"),
       url("data:font/ttf;base64,${boldB64}") format("truetype");
}
`;
  return cachedFaceCss;
}

export function resetCompositeFontCache(): void {
  cachedFaceCss = null;
}
