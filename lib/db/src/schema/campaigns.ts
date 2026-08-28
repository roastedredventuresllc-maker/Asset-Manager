import { pgTable, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignsTable = pgTable("campaigns", {
  id: text("id").primaryKey(),
  userId: text("user_id"), // null until claimed via checkout
  brief: text("brief").notNull(),
  productImageUrl: text("product_image_url"),
  campaignJson: jsonb("campaign_json"), // AI-generated CampaignData object
  status: text("status").notNull().default("draft"), // draft | generating | ready | publishing | in_review | rejected | live | paused | error
  landingSlug: text("landing_slug"),
  revisionsUsed: integer("revisions_used").notNull().default(0),
  revisionsAllowed: integer("revisions_allowed").notNull().default(3),
  // Media-agency guardrails. Client brands use per-customer ad accounts;
  // house env IDs are LaunchPad's own tests only.
  budgetCapCents: integer("budget_cap_cents"), // total spend cap; auto-pause when reached
  pendingPublishJson: jsonb("pending_publish_json"), // publish options stored at checkout, used on admin approval
  riskFlagsJson: jsonb("risk_flags_json"), // AI moderation pre-check result
  /** When true, this campaign is a LaunchPad house test and may use house env IDs. */
  isHouseTest: boolean("is_house_test").notNull().default(false),
  /** Optional per-campaign ID override (wins over the client's stored row). Identifiers only. */
  adAccountJson: jsonb("ad_account_json"),
  /** Snapshot of the account IDs actually used at publish time (no tokens). */
  publishedAccountJson: jsonb("published_account_json"),
  rejectionReason: text("rejection_reason"), // set when an admin rejects the campaign
  pausedReason: text("paused_reason"), // "budget_cap" | "admin" | "user"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
