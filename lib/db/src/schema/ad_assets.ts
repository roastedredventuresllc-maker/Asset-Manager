import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adAssetsTable = pgTable("ad_assets", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  idx: integer("idx").notNull(), // 0, 1, 2 — which ad slot
  imageUrl: text("image_url"),
  format: text("format"), // "1080x1080" | "1080x1920"
  model: text("model"), // "fal/flux" | "fal/ideogram" | "svg-fallback"
  costCents: integer("cost_cents").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | processing | done | failed
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAdAssetSchema = createInsertSchema(adAssetsTable).omit({ createdAt: true, updatedAt: true });
export type InsertAdAsset = z.infer<typeof insertAdAssetSchema>;
export type AdAsset = typeof adAssetsTable.$inferSelect;
