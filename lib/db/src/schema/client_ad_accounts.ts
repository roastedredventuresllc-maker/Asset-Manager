import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Per-customer ad-account targeting. Client brands publish to these IDs, never
 * to LaunchPad house env defaults. House META_*, TIKTOK_*, and GOOGLE_* credentials
 * remain for LaunchPad's own test campaigns only.
 *
 * Account IDs are identifiers (not API tokens) and are stored in plaintext.
 * Partner/BOBO/MCC access still requires a human; status fields record that
 * progress as step names, not secrets.
 */
export const clientAdAccountsTable = pgTable("client_ad_accounts", {
  userId: text("user_id").primaryKey(),
  /** When true, this user is LaunchPad itself — campaigns may use house env IDs. */
  isHouse: boolean("is_house").notNull().default(false),
  /** Client Meta Ad Account ID (digits). Used as /act_{id}, not a Business Manager ID. */
  metaAdAccountId: text("meta_ad_account_id"),
  /** Client Facebook Page ID for creatives. */
  metaPageId: text("meta_page_id"),
  /** Client Business Manager ID — used for the On Behalf Of request, not /act_ paths. */
  metaClientBusinessId: text("meta_client_business_id"),
  /** none | requested | granted — Business On Behalf Of consent. */
  metaBoboStatus: text("meta_bobo_status").notNull().default("none"),
  /** Client-owned TikTok advertiser ID. */
  tiktokAdvertiserId: text("tiktok_advertiser_id"),
  /** Client CUSTOMIZED_USER identity ID (required for image ads). */
  tiktokIdentityId: text("tiktok_identity_id"),
  /** none | requested | granted — TikTok partner access. */
  tiktokPartnerStatus: text("tiktok_partner_status").notNull().default("none"),
  /** Client Google Ads Customer ID under LaunchPad's MCC. */
  googleCustomerId: text("google_customer_id"),
  /** none | requested | granted — MCC manager invitation. */
  googleMccLinkStatus: text("google_mcc_link_status").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ClientAdAccount = typeof clientAdAccountsTable.$inferSelect;
export type InsertClientAdAccount = typeof clientAdAccountsTable.$inferInsert;
