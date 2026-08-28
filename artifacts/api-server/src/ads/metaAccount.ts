/**
 * META_BUSINESS_ID in this product is the Meta *Ad Account* ID, not a
 * Business Manager ID. Live Marketing API paths are `/act_${id}/...`.
 * Accept optional `act_` prefix and non-digits; persist digits only.
 */
export function normalizeMetaAdAccountId(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.trim().replace(/^act_/i, "").replace(/[^\d]/g, "");
}

export function isMetaAdAccountId(raw: string | undefined | null): boolean {
  return /^\d{5,}$/.test(normalizeMetaAdAccountId(raw));
}
