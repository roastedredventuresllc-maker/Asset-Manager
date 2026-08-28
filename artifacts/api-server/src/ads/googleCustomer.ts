/** Google Ads customer IDs are digits; dash-formatted IDs from the UI must be stripped. */
export function normalizeGoogleCustomerId(raw: string | undefined | null): string {
  return (raw ?? "").replace(/[-\s]/g, "").trim();
}
