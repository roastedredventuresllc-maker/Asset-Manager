import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
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
  // Media-agency guardrails (house-account model)
  budgetCapCents: integer("budget_cap_cents"), // total spend cap; auto-pause when reached
  pendingPublishJson: jsonb("pending_publish_json"), // publish options stored at checkout, used on admin approval
  riskFlagsJson: jsonb("risk_flags_json"), // AI moderation pre-check result
  rejectionReason: text("rejection_reason"), // set when an admin rejects the campaign
  pausedReason: text("paused_reason"), // "budget_cap" | "admin" | "user"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
