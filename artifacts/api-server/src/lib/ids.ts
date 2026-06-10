import { randomBytes } from "crypto";

export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function generateSlug(brandName: string): string {
  const base = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);
  const suffix = randomBytes(4).toString("hex");
  return `${base}-${suffix}`;
}
