import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Encrypted ad-platform credentials entered by an admin through the Connectors
 * UI — an alternative to the Replit Secrets pane. One row per platform. The
 * secret values are AES-256-GCM encrypted at rest into `encryptedData` (an
 * envelope of { v, alg, salt, iv, tag, ciphertext }); plaintext secret values
 * are NEVER persisted. See artifacts/api-server/src/ads/credentials.ts for the
 * crypto + access layer.
 */
export const platformCredentialsTable = pgTable("platform_credentials", {
  platform: text("platform").primaryKey(),
  encryptedData: jsonb("encrypted_data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type PlatformCredential = typeof platformCredentialsTable.$inferSelect;
