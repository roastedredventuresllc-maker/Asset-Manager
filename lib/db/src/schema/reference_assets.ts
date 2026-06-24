import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Real ad-creative reference images that make up the in-house reference corpus.
 * These are best-in-class examples — curated from the web (source = "curated",
 * with sourceUrl attribution) or uploaded by an admin (source = "uploaded").
 * Each image is vision-analysed and the structured notes are stored in
 * `analysis`; those notes are retrieved (RAG) at generation time to sharpen the
 * model's taste. This is a reference library, NOT model training data.
 */
export const referenceAssetsTable = pgTable("reference_assets", {
  id: text("id").primaryKey(),
  // platform slug: tiktok | instagram-stories | instagram-feed | facebook | google-ads | linkedin
  platform: text("platform").notNull(),
  source: text("source").notNull().default("curated"), // curated | uploaded
  sourceUrl: text("source_url"), // attribution for curated examples
  title: text("title"),
  imageKey: text("image_key").notNull(), // storage key (served via /api/assets/<key>)
  imageUrl: text("image_url").notNull(),
  // stable dedupe key for curated seeds (null for uploads)
  seedKey: text("seed_key"),
  status: text("status").notNull().default("analyzing"), // analyzing | ready | failed
  analysis: jsonb("analysis"), // { format, hook, angle, visualTokens[], copyPattern, tone, whyItWorks }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertReferenceAssetSchema = createInsertSchema(referenceAssetsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertReferenceAsset = z.infer<typeof insertReferenceAssetSchema>;
export type ReferenceAsset = typeof referenceAssetsTable.$inferSelect;

export interface ReferenceAnalysis {
  format: string;
  hook: string;
  angle: string;
  visualTokens: string[];
  copyPattern: string;
  tone: string;
  whyItWorks: string;
}
