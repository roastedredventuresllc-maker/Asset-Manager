import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type SharpFn = typeof import("sharp");

let cached: SharpFn | null = null;

/**
 * esbuild CJS (`server.cjs`) leaves `await import("sharp")` as a native
 * dynamic import. Node then yields `{ default: SharpFn }`. If the bundle
 * also runs that namespace through `__toESM` (no `__esModule` flag),
 * `default` becomes the namespace object — `TypeError: sharp is not a
 * function` in rejectIfFlatGradient after Imagine already produced a plate.
 *
 * require("sharp") is the CJS function. Walk `.default` until we have it.
 */
export function unwrapSharpExport(mod: unknown): SharpFn {
  let current: unknown = mod;
  for (let i = 0; i < 4; i++) {
    if (typeof current === "function") return current as SharpFn;
    if (current && typeof current === "object" && "default" in current) {
      current = (current as { default: unknown }).default;
      continue;
    }
    break;
  }
  throw new Error(
    `sharp is not a function (got ${typeof current}). Craft cannot inspect Imagine plates.`,
  );
}

function requireSharp(): unknown {
  const anchors: string[] = [];
  const meta = import.meta.url;
  if (typeof meta === "string" && meta.startsWith("file:")) {
    anchors.push(fileURLToPath(meta));
  }
  const bundled = (globalThis as { __filename?: string }).__filename;
  if (typeof bundled === "string" && bundled.length > 0) {
    anchors.push(bundled);
  }
  anchors.push(path.join(process.cwd(), "server.cjs"));
  anchors.push(path.join(process.cwd(), "package.json"));

  let lastErr: unknown;
  for (const anchor of anchors) {
    try {
      return createRequire(anchor)("sharp");
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Cannot require sharp");
}

/** Load sharp as a callable function. Verified at runtime, not by file existence. */
export async function loadSharp(): Promise<SharpFn> {
  if (cached) return cached;
  let raw: unknown;
  try {
    raw = requireSharp();
  } catch {
    raw = await import("sharp");
  }
  cached = unwrapSharpExport(raw);
  return cached;
}

/** Test / bundle seam — drop the process-local cache. */
export function resetSharpCache(): void {
  cached = null;
}
