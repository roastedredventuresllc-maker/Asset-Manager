import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { eq } from "drizzle-orm";
import { db, platformCredentialsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { normalizeMetaAdAccountId } from "./metaAccount.js";
import { normalizeGoogleCustomerId } from "./googleCustomer.js";

/**
 * Encrypted-at-rest credential storage for ad-platform connectors. Admins may
 * enter platform secrets through the Connectors UI instead of the Replit
 * Secrets pane; we encrypt them with AES-256-GCM and persist the envelope in
 * `platform_credentials`. The encryption key is derived (scrypt) from
 * ADMIN_PASSWORD with a per-row random salt.
 *
 * TRADEOFF: because the key is derived from ADMIN_PASSWORD, rotating
 * ADMIN_PASSWORD invalidates every stored credential — they must be re-entered.
 * Environment-variable secrets are unaffected (read straight from the
 * environment). This module is deliberately decoupled from connectors.ts: the
 * caller passes the allow-list of key names, so there is no import cycle.
 */

const ALG = "aes-256-gcm";
const ENVELOPE_VERSION = 1;

interface CredentialEnvelope {
  v: number;
  alg: string;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

export type CredentialValues = Record<string, string | undefined>;

export interface ResolvedCredentials {
  values: CredentialValues;
  source: "stored" | "env" | "none";
}

export interface CredentialState {
  connected: boolean;
  missingKeys: string[];
  optionalPresentKeys: string[];
  storedKeys: string[];
  source: "stored" | "env" | "none";
}

function masterPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length === 0) {
    throw new Error(
      "ADMIN_PASSWORD is not set; cannot encrypt or decrypt stored credentials.",
    );
  }
  return pw;
}

function hasEnv(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

function encryptValues(values: Record<string, string>): CredentialEnvelope {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(masterPassword(), salt, 32);
  const cipher = createCipheriv(ALG, key, iv);
  const plaintext = Buffer.from(JSON.stringify(values), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: ENVELOPE_VERSION,
    alg: ALG,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
  };
}

function decryptValues(envelope: CredentialEnvelope): Record<string, string> {
  const key = scryptSync(masterPassword(), Buffer.from(envelope.salt, "hex"), 32);
  const decipher = createDecipheriv(ALG, key, Buffer.from(envelope.iv, "hex"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "hex")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(plaintext.toString("utf8")) as unknown;
  const out: Record<string, string> = {};
  if (parsed && typeof parsed === "object") {
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
  }
  return out;
}

/** Load + decrypt the stored values for a platform. Returns null on miss/error. */
async function loadStored(platform: string): Promise<Record<string, string> | null> {
  let row: typeof platformCredentialsTable.$inferSelect | undefined;
  try {
    [row] = await db
      .select()
      .from(platformCredentialsTable)
      .where(eq(platformCredentialsTable.platform, platform))
      .limit(1);
  } catch (err) {
    logger.error({ err, platform }, "Failed to read stored credentials");
    return null;
  }
  if (!row) return null;
  try {
    return decryptValues(row.encryptedData as CredentialEnvelope);
  } catch (err) {
    // Most likely ADMIN_PASSWORD was rotated, so this row can no longer be
    // decrypted. Treat as absent (connector falls back to env / not-connected).
    logger.error(
      { err, platform },
      "Failed to decrypt stored credentials (was ADMIN_PASSWORD rotated?)",
    );
    return null;
  }
}

/**
 * Persist credentials for a platform. Only keys in `allowedKeys` are kept;
 * incoming blank values are ignored so an Edit that leaves a field empty keeps
 * the previously-saved secret rather than wiping it. Returns the stored key
 * NAMES (never values).
 */
export async function saveCredentials(
  platform: string,
  incoming: Record<string, unknown>,
  allowedKeys: string[],
): Promise<string[]> {
  const existing = (await loadStored(platform)) ?? {};
  const aliased: Record<string, unknown> = { ...incoming };
  if (platform === "meta") {
    const alias = incoming.META_AD_ACCOUNT_ID;
    if (
      typeof alias === "string" &&
      alias.trim().length > 0 &&
      !(typeof incoming.META_BUSINESS_ID === "string" && incoming.META_BUSINESS_ID.trim())
    ) {
      aliased.META_BUSINESS_ID = alias;
    }
  }
  const merged: Record<string, string> = {};
  for (const key of allowedKeys) {
    const next = aliased[key];
    const prev = existing[key];
    if (typeof next === "string" && next.trim().length > 0) {
      let value = next.trim();
      if (key === "META_BUSINESS_ID") {
        value = normalizeMetaAdAccountId(value);
      }
      if (key === "GOOGLE_ADS_CUSTOMER_ID" || key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID") {
        value = normalizeGoogleCustomerId(value);
      }
      merged[key] = value;
    } else if (typeof prev === "string" && prev.length > 0) {
      merged[key] = prev;
    }
  }
  const envelope = encryptValues(merged);
  await db
    .insert(platformCredentialsTable)
    .values({ platform, encryptedData: envelope })
    .onConflictDoUpdate({
      target: platformCredentialsTable.platform,
      set: { encryptedData: envelope, updatedAt: new Date() },
    });
  return Object.keys(merged);
}

/** Remove all stored credentials for a platform. */
export async function deleteCredentials(platform: string): Promise<void> {
  await db
    .delete(platformCredentialsTable)
    .where(eq(platformCredentialsTable.platform, platform));
}

/**
 * Resolve the effective credential values for a platform: a stored value wins
 * over the environment variable of the same name; otherwise the env var is
 * used. Only `allowedKeys` are returned. These values are for in-process use by
 * the live ad clients only — never serialise them to a response.
 */
export async function resolveCredentials(
  platform: string,
  allowedKeys: string[],
): Promise<ResolvedCredentials> {
  const stored = await loadStored(platform);
  const values: CredentialValues = {};
  let usedStored = false;
  let usedEnv = false;
  for (const key of allowedKeys) {
    const s = stored?.[key];
    if (typeof s === "string" && s.length > 0) {
      values[key] = s;
      usedStored = true;
      continue;
    }
    const e = process.env[key];
    if (typeof e === "string" && e.trim().length > 0) {
      values[key] = e;
      usedEnv = true;
      continue;
    }
    values[key] = undefined;
  }
  const source: ResolvedCredentials["source"] = usedStored
    ? "stored"
    : usedEnv
      ? "env"
      : "none";
  return { values, source };
}

/**
 * Compute connection state for a platform from stored + env credentials,
 * returning only key NAMES and booleans (never values) for the admin UI.
 */
export async function credentialState(
  platform: string,
  requiredKeys: string[],
  optionalKeys: string[],
): Promise<CredentialState> {
  const allowed = [...requiredKeys, ...optionalKeys];
  const stored = await loadStored(platform);
  const storedKeys = allowed.filter((k) => {
    const v = stored?.[k];
    return typeof v === "string" && v.length > 0;
  });
  const present = (k: string): boolean => storedKeys.includes(k) || hasEnv(k);
  const missingKeys = requiredKeys.filter((k) => !present(k));
  const optionalPresentKeys = optionalKeys.filter((k) => present(k));
  const anyEnv = allowed.some((k) => !storedKeys.includes(k) && hasEnv(k));
  const source: CredentialState["source"] =
    storedKeys.length > 0 ? "stored" : anyEnv ? "env" : "none";
  return {
    connected: missingKeys.length === 0,
    missingKeys,
    optionalPresentKeys,
    storedKeys,
    source,
  };
}
