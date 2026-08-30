/**
 * Resolve the sharp factory across CJS/ESM interop.
 *
 * The Vercel Express bundle is CJS (`server.cjs`) with `sharp` external.
 * `const { default: sharp } = await import("sharp")` then yields a namespace
 * object (`{ default: fn }`), so `sharp` is not a function and Craft lock
 * rejects every Imagine plate.
 */
export type SharpFn = typeof import("sharp");

export function unwrapSharp(mod: unknown): SharpFn {
  let current: unknown = mod;
  for (let i = 0; i < 3; i++) {
    if (typeof current === "function") return current as SharpFn;
    if (!current || typeof current !== "object") break;
    current = (current as { default?: unknown }).default;
  }
  throw new TypeError("sharp is not a function");
}

export async function loadSharp(): Promise<SharpFn> {
  return unwrapSharp(await import("sharp"));
}
