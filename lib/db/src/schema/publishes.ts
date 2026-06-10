import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const publishesTable = pgTable("publishes", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  platform: text("platform").notNull(), // "meta" | "tiktok"
  externalCampaignId: text("external_campaign_id"),
  externalAdSetId: text("external_ad_set_id"),
  externalAdId: text("external_ad_id"),
  dailyBudgetCents: integer("daily_budget_cents").notNull(),
  status: text("status").notNull().default("pending"), // pending | active | paused | failed
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPublishSchema = createInsertSchema(publishesTable).omit({ createdAt: true, updatedAt: true });
export type InsertPublish = z.infer<typeof insertPublishSchema>;
export type Publish = typeof publishesTable.$inferSelect;
