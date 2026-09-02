import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type SharpFn = typeof import("sharp");

let cached: SharpFn | null = null;

/**
 * Production (`dpl_4YqDeAUDCRVqXaQnCU59ycvE54k2`): walking `.default` on the
 * ESM namespace still ended as `{ default: … }` / a property bag —
 * `Error: sharp is not a function (got object)` in rejectIfFlatGradient.
 *
 * The lambda must `require()` the CommonJS constructor. The unbundled
 * `sharp-fn.cjs` next to server.cjs does exactly that. Never `import("sharp")`.
 */
export function unwrapSharpExport(mod: unknown): SharpFn {
  if (typeof mod === "function") return mod as SharpFn;
  if (mod && typeof mod === "object" && "default" in mod) {
    const inner = (mod as { default: unknown }).default;
    if (typeof inner === "function") return inner as SharpFn;
    if (inner && typeof inner === "object" && "default" in inner) {
      const nested = (inner as { default: unknown }).default;
      if (typeof nested === "function") return nested as SharpFn;
    }
  }
  throw new Error(
    `sharp is not a function (got ${typeof mod}). Craft cannot inspect Imagine plates.`,
  );
}

function requireCjsSharp(): unknown {
  const injected = (globalThis as { __launchpadSharp?: unknown }).__launchpadSharp;
  if (typeof injected === "function") return injected;

  const anchors: string[] = [];
  const bundled = (globalThis as { __filename?: string }).__filename;
  if (typeof bundled === "string" && bundled.length > 0) {
    anchors.push(bundled);
  }
  const meta = import.meta.url;
  if (typeof meta === "string" && meta.startsWith("file:")) {
    anchors.push(fileURLToPath(meta));
  }
  anchors.push(path.join(process.cwd(), "server.cjs"));
  anchors.push(path.join(process.cwd(), "package.json"));

  let lastErr: unknown;
  for (const anchor of anchors) {
    const req = createRequire(anchor);
    try {
      const shim = req("./sharp-fn.cjs");
      if (typeof shim === "function") return shim;
    } catch (err) {
      lastErr = err;
    }
    try {
      const raw = req("sharp");
      if (typeof raw === "function") return raw;
      if (raw && typeof (raw as { default?: unknown }).default === "function") {
        return (raw as { default: unknown }).default;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Cannot require sharp CJS export");
}

/** Load sharp as a callable function. Verified at runtime, not by file existence. */
export async function loadSharp(): Promise<SharpFn> {
  if (cached) return cached;
  cached = unwrapSharpExport(requireCjsSharp());
  return cached;
}

/** Test / bundle seam — drop the process-local cache. */
export function resetSharpCache(): void {
  cached = null;
}
