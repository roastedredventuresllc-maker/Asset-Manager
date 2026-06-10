import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const metricsSnapshotsTable = pgTable("metrics_snapshots", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  platform: text("platform").notNull(), // "meta" | "tiktok" | "total"
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  spendCents: integer("spend_cents").notNull().default(0),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMetricsSnapshotSchema = createInsertSchema(metricsSnapshotsTable).omit({ snapshotAt: true });
export type InsertMetricsSnapshot = z.infer<typeof insertMetricsSnapshotSchema>;
export type MetricsSnapshot = typeof metricsSnapshotsTable.$inferSelect;
