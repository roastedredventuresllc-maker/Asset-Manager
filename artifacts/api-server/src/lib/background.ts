import { waitUntil } from "@vercel/functions";

/**
 * Keep work alive after the HTTP response on Vercel (Fluid Compute).
 * Locally this still runs the promise; it is not fire-and-forget in the
 * "process may freeze" sense — waitUntil is a no-op host outside Vercel
 * aside from scheduling the promise.
 */
export function runInBackground(work: Promise<unknown>): void {
  waitUntil(work);
}
