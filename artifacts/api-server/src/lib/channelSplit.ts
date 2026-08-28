/**
 * v1 budget split is Meta + TikTok + Google (must sum to 100).
 * LinkedIn is out of v1 and must not appear here.
 *
 * If Google's share is omitted, it is the remainder so the three channels
 * still add up. An explicit 0 is respected (do not backfill).
 */
export function resolveGoogleSharePct(
  metaSharePct: number,
  tiktokSharePct: number,
  googleSharePct?: number | null,
): number {
  if (typeof googleSharePct === "number" && Number.isFinite(googleSharePct)) {
    return Math.max(0, Math.min(100, Math.round(googleSharePct)));
  }
  return Math.max(0, 100 - (metaSharePct || 0) - (tiktokSharePct || 0));
}
