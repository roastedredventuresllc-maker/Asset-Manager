import * as vercelFunctions from "@vercel/functions";

function resolveWaitUntil(): ((work: Promise<unknown>) => void) | undefined {
  const rec = vercelFunctions as unknown as {
    waitUntil?: unknown;
    default?: { waitUntil?: unknown };
  };
  const candidate = rec.waitUntil ?? rec.default?.waitUntil;
  return typeof candidate === "function"
    ? (candidate as (work: Promise<unknown>) => void)
    : undefined;
}

/**
 * Keep work alive after the HTTP response on Vercel (Fluid Compute).
 * Call this only after res.json — starting heavy work first prevents Express
 * from flushing the body.
 */
export function runInBackground(work: Promise<unknown>): void {
  const waitUntil = resolveWaitUntil();
  if (waitUntil) {
    waitUntil(work);
    return;
  }
  void work;
}
