import {
  db,
  campaignsTable,
  adAssetsTable,
  publishesTable,
  metricsSnapshotsTable,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { generateCampaign, reviseCampaign } from "./claude.js";
import { generateId, generateSlug } from "./ids.js";
import { getAdPlatformForCampaign } from "../ads/index.js";
import { adsMode } from "../ads/connectors.js";
import {
  publishCampaignToPlatforms,
  type PublishOptions,
  type PublishOutcome,
} from "./publish.js";
import { logger } from "./logger.js";
import { resolveGoogleSharePct } from "./channelSplit.js";
import { publicOrigin } from "./assetUrl.js";
import { JOB_STATUS } from "./jobStatus.js";
import { runInBackground } from "./background.js";
import { processPendingJobs } from "./worker.js";
import { COPY_DEADLINE_MS, withDeadline } from "./copyDeadline.js";

export { COPY_DEADLINE_MS, withDeadline } from "./copyDeadline.js";

/**
 * Shared campaign business logic used by both the REST routes
 * (`routes/campaigns.ts`) and the MCP server (`mcp/server.ts`).
 *
 * Functions throw `ServiceError` for expected failure cases so callers can map
 * them to HTTP status codes or MCP error responses without duplicating logic.
 */
export class ServiceError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.code = code;
  }
}

type CampaignRecord = typeof campaignsTable.$inferSelect;

export function toCampaignResponse(campaign: CampaignRecord) {
  const origin = publicOrigin();
  return {
    id: campaign.id,
    userId: campaign.userId,
    brief: campaign.brief,
    productImageUrl: campaign.productImageUrl,
    campaignData: campaign.campaignJson ?? null,
    status: campaign.status,
    landingSlug: campaign.landingSlug,
    landingUrl: campaign.landingSlug ? `${origin}/p/${campaign.landingSlug}` : null,
    revisionsUsed: campaign.revisionsUsed,
    revisionsAllowed: campaign.revisionsAllowed,
    budgetCapCents: campaign.budgetCapCents ?? null,
    rejectionReason: campaign.rejectionReason ?? null,
    pausedReason: campaign.pausedReason ?? null,
    createdAt: campaign.createdAt.toISOString(),
  };
}

/**
 * Estimate lifetime spend for a campaign from its metrics snapshots. Platform
 * metrics report "today so far", so lifetime spend = sum over days of the
 * daily maximum observed on the "total" snapshot row.
 *
 * Known limitation: days are bucketed by snapshot time in UTC while ad
 * platforms reset "today" in the ad account's timezone. If those differ, the
 * estimate can briefly undercount right after the platform's daily reset, so
 * the cap is best-effort, not to-the-cent.
 */
export async function getLifetimeSpendCents(campaignId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(day_max), 0)::int AS lifetime
    FROM (
      SELECT date_trunc('day', snapshot_at) AS day, MAX(spend_cents) AS day_max
      FROM metrics_snapshots
      WHERE campaign_id = ${campaignId} AND platform = 'total'
      GROUP BY 1
    ) daily
  `);
  const row = (result.rows?.[0] ?? {}) as { lifetime?: number };
  return row.lifetime ?? 0;
}

/** Fetch the raw campaign row, or null if it does not exist. */
export async function getCampaignRecord(
  id: string,
): Promise<CampaignRecord | undefined> {
  return db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, id),
  });
}

/**
 * Grok writes campaign JSON from the founder brief and enqueues stills jobs.
 * Does not wait for photography — the briefing can present as soon as copy
 * is `ready`. Returns job ids so the caller can drain stills in the background.
 */
export async function writeCampaignCopy(
  campaignId: string,
  brief: string,
  productImageUrl: string | null,
  productImageNoBgUrl?: string | null,
): Promise<string[]> {
  try {
    const campaignData = await withDeadline(
      generateCampaign(brief, {
        hasProductPhoto: Boolean(productImageUrl || productImageNoBgUrl),
      }),
      COPY_DEADLINE_MS,
      () =>
        new ServiceError(504, "copy_timeout", "Grok copy timed out"),
    );
    const landingSlug = generateSlug(campaignData.brandName);

    await db
      .update(campaignsTable)
      .set({
        campaignJson: campaignData as object,
        status: "ready",
        landingSlug,
      })
      .where(eq(campaignsTable.id, campaignId));

    const { jobsTable } = await import("@workspace/db");
    const jobIds: string[] = [];

    for (let idx = 0; idx < 3; idx++) {
      const ad = campaignData.ads[idx];
      if (!ad) continue;

      const asset = await db.query.adAssetsTable.findFirst({
        where: and(
          eq(adAssetsTable.campaignId, campaignId),
          eq(adAssetsTable.idx, idx),
        ),
      });
      if (!asset) continue;

      const jobId = generateId("job");
      jobIds.push(jobId);
      await db.insert(jobsTable).values({
        id: jobId,
        type: "generate_image",
        payload: {
          campaignId,
          adAssetId: asset.id,
          idx,
          ad,
          brandName: campaignData.brandName,
          productImageUrl,
          productImageNoBgUrl: productImageNoBgUrl ?? null,
        },
        status: JOB_STATUS.pending,
      });
    }

    logger.info({ campaignId }, "Campaign copy ready; stills enqueued");
    return jobIds;
  } catch (err) {
    logger.error({ err, campaignId }, "Campaign generation error");
    await db
      .update(campaignsTable)
      .set({ status: "error" })
      .where(eq(campaignsTable.id, campaignId));
    if (err instanceof ServiceError) throw err;
    const message = err instanceof Error ? err.message : "Campaign copy failed";
    if (/timed out/i.test(message)) {
      throw new ServiceError(504, "copy_timeout", message);
    }
    throw new ServiceError(502, "copy_failed", message);
  }
}

/** @deprecated Prefer writeCampaignCopy + a background stills drain. */
export async function generateCampaignAsync(
  campaignId: string,
  brief: string,
  productImageUrl: string | null,
  productImageNoBgUrl?: string | null,
): Promise<void> {
  const jobIds = await writeCampaignCopy(
    campaignId,
    brief,
    productImageUrl,
    productImageNoBgUrl,
  );
  if (jobIds.length === 0) return;
  try {
    await processPendingJobs(3, { jobIds });
  } catch (err) {
    logger.error({ err, campaignId }, "Image job drain after generate failed");
  }
}

/**
 * Create a campaign record plus three placeholder ad assets, then write copy.
 * Returns `{ campaign, stillsJobIds }` so the HTTP handler can flush JSON
 * before any Imagine/Craft/sharp work. `userId` is optional — anonymous web
 * users create campaigns with a null userId (claimed later via checkout), while
 * MCP callers pass their authenticated userId so the campaign is owned up-front.
 */
export async function createCampaign(input: {
  brief: string;
  productImageUrl?: string | null;
  productImageNoBgUrl?: string | null;
  userId?: string | null;
}) {
  const brief = input.brief?.trim();
  if (!brief || brief.length < 5) {
    throw new ServiceError(400, "invalid_brief", "brief is required (min 5 chars)");
  }

  const id = generateId("cmp");
  const productImageUrl = input.productImageUrl ?? null;
  const productImageNoBgUrl = input.productImageNoBgUrl ?? null;

  await db.insert(campaignsTable).values({
    id,
    userId: input.userId ?? null,
    brief,
    productImageUrl,
    status: "generating",
    revisionsUsed: 0,
    revisionsAllowed: 3,
  });

  for (let idx = 0; idx < 3; idx++) {
    await db.insert(adAssetsTable).values({
      id: generateId("ast"),
      campaignId: id,
      idx,
      status: "pending",
    });
  }

  // Await copy only. The HTTP handler must res.json before any stills
  // drain — waitUntil before the 201 held the Hobby response until Craft
  // finished (~127s) and the founder UI died at ~60s with 0 bytes.
  const stillsJobIds = await writeCampaignCopy(
    id,
    brief,
    productImageUrl,
    productImageNoBgUrl,
  );

  const campaign = await getCampaignRecord(id);
  return { campaign: toCampaignResponse(campaign!), stillsJobIds };
}

/** Start Imagine→gpt-image-2 after the generate JSON has already been sent. */
export function drainStillsInBackground(campaignId: string, jobIds: string[]): void {
  if (jobIds.length === 0) return;
  runInBackground(
    processPendingJobs(3, { jobIds }).catch((err) => {
      logger.error({ err, campaignId }, "Image job drain after generate failed");
    }),
  );
}

/**
 * Drain this campaign's stills. If copy exists but the three frames already
 * failed (or never queued), enqueue one new Imagine→gpt-image-2 job per
 * missing still — do not POST generate again.
 */
export async function renderCampaignStills(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  if (!campaign.campaignJson) {
    throw new ServiceError(400, "not_generated", "campaign not generated yet");
  }

  const { jobsTable } = await import("@workspace/db");
  const alreadyPending = await db.query.jobsTable.findMany({
    where: and(
      eq(jobsTable.status, JOB_STATUS.pending),
      sql`${jobsTable.payload}->>'campaignId' = ${id}`,
    ),
    limit: 3,
  });

  if (alreadyPending.length === 0) {
    const cj = campaign.campaignJson as {
      brandName?: string;
      ads?: Array<Record<string, unknown>>;
    };
    const assets = await db.query.adAssetsTable.findMany({
      where: eq(adAssetsTable.campaignId, id),
      orderBy: [adAssetsTable.idx],
    });

    for (const asset of assets) {
      if (asset.status === JOB_STATUS.done && asset.imageUrl) continue;
      const ad = cj.ads?.[asset.idx];
      if (!ad) continue;

      await db
        .update(adAssetsTable)
        .set({ status: "pending", imageUrl: null, model: null })
        .where(eq(adAssetsTable.id, asset.id));

      await db.insert(jobsTable).values({
        id: generateId("job"),
        type: "generate_image",
        payload: {
          campaignId: id,
          adAssetId: asset.id,
          idx: asset.idx,
          ad,
          brandName: cj.brandName ?? "",
          productImageUrl: campaign.productImageUrl,
          productImageNoBgUrl: null,
        },
        status: JOB_STATUS.pending,
      });
    }
  }

  const drained = await processPendingJobs(3, { campaignId: id });
  const failedJobs = await db.query.jobsTable.findMany({
    where: and(
      eq(jobsTable.status, JOB_STATUS.failed),
      sql`${jobsTable.payload}->>'campaignId' = ${id}`,
    ),
    orderBy: [desc(jobsTable.createdAt)],
    limit: 3,
  });
  return {
    ...drained,
    lastErrors: failedJobs
      .map((j) => j.lastError)
      .filter((e): e is string => Boolean(e)),
  };
}

/** List campaign summaries for a user, newest first. */
export async function listCampaignsForUser(userId: string) {
  const campaigns = await db.query.campaignsTable.findMany({
    where: eq(campaignsTable.userId, userId),
    orderBy: [desc(campaignsTable.createdAt)],
  });

  return Promise.all(
    campaigns.map(async (c) => {
      let spendTodayCents: number | null = null;
      let lifetimeSpendCents: number | null = null;
      if (c.status === "live" || c.status === "paused") {
        const latest = await db.query.metricsSnapshotsTable.findFirst({
          where: and(
            eq(metricsSnapshotsTable.campaignId, c.id),
            eq(metricsSnapshotsTable.platform, "total"),
          ),
          orderBy: [desc(metricsSnapshotsTable.snapshotAt)],
        });
        spendTodayCents = latest?.spendCents ?? 0;
        lifetimeSpendCents = await getLifetimeSpendCents(c.id);
      }
      const cj = c.campaignJson as { brandName?: string } | null;
      return {
        id: c.id,
        brandName: cj?.brandName ?? "Untitled",
        status: c.status,
        spendTodayCents,
        lifetimeSpendCents,
        budgetCapCents: c.budgetCapCents ?? null,
        pausedReason: c.pausedReason ?? null,
        createdAt: c.createdAt.toISOString(),
      };
    }),
  );
}

/** Full campaign details. Throws 404 if not found. */
export async function getCampaign(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  return toCampaignResponse(campaign);
}

/** Generation/image status plus per-asset image URLs. Throws 404 if not found. */
export async function getCampaignStatus(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");

  const assets = await db.query.adAssetsTable.findMany({
    where: eq(adAssetsTable.campaignId, id),
    orderBy: [adAssetsTable.idx],
  });

  const stillsPending = assets.some(
    (a) => a.status !== JOB_STATUS.done && a.status !== JOB_STATUS.failed,
  );
  if (stillsPending) {
    // Keep photography moving if generate's waitUntil froze the isolate.
    runInBackground(
      processPendingJobs(3, { campaignId: id }).catch((err) => {
        logger.error({ err, campaignId: id }, "Status-poll stills drain failed");
      }),
    );
  }

  const lifetimeSpendCents =
    campaign.status === "live" || campaign.status === "paused"
      ? await getLifetimeSpendCents(id)
      : null;

  const { jobsTable } = await import("@workspace/db");
  const recentJobs = await db.query.jobsTable.findMany({
    where: sql`${jobsTable.payload}->>'campaignId' = ${id}`,
    orderBy: [desc(jobsTable.createdAt)],
    limit: 12,
  });
  const errorByIdx = new Map<number, string | null>();
  for (const job of recentJobs) {
    const payload = job.payload as { idx?: number };
    if (typeof payload.idx !== "number" || errorByIdx.has(payload.idx)) continue;
    errorByIdx.set(payload.idx, job.lastError ?? null);
  }

  return {
    id: campaign.id,
    status: campaign.status,
    rejectionReason: campaign.rejectionReason ?? null,
    pausedReason: campaign.pausedReason ?? null,
    budgetCapCents: campaign.budgetCapCents ?? null,
    lifetimeSpendCents,
    campaignData: campaign.campaignJson ?? null,
    adAssets: assets.map((a) => ({
      idx: a.idx,
      imageUrl: a.imageUrl ?? null,
      status: a.status,
      model: a.model ?? null,
      lastError: errorByIdx.get(a.idx) ?? null,
    })),
  };
}

/** Revise a campaign in natural language. Enforces the draft revision limit. */
export async function reviseCampaignById(id: string, request: string) {
  if (!request || typeof request !== "string" || request.trim().length === 0) {
    throw new ServiceError(400, "invalid_request", "request required");
  }

  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");

  if (campaign.status === "draft" || campaign.status === "ready") {
    if (campaign.revisionsUsed >= campaign.revisionsAllowed) {
      throw new ServiceError(
        403,
        "revision_limit_reached",
        "Ship it to unlock unlimited revisions.",
      );
    }
  }

  const existing = campaign.campaignJson as object;
  if (!existing) {
    throw new ServiceError(400, "not_generated", "campaign not yet generated");
  }

  const { campaign: updated, visualChanged } = await reviseCampaign(
    existing as Parameters<typeof reviseCampaign>[0],
    request,
  );

  const newSlug = generateSlug(updated.brandName);

  await db
    .update(campaignsTable)
    .set({
      campaignJson: updated as object,
      landingSlug: newSlug,
      revisionsUsed: campaign.revisionsUsed + 1,
    })
    .where(eq(campaignsTable.id, id));

  if (visualChanged) {
    const { jobsTable } = await import("@workspace/db");

    // Recover the no-bg URL from the most recent done job payload for
    // this campaign. Same enum the worker writes (JOB_STATUS.done).
    let productImageNoBgUrl: string | null = null;
    const prevJob = await db.query.jobsTable.findFirst({
      where: and(
        eq(jobsTable.type, "generate_image"),
        eq(jobsTable.status, JOB_STATUS.done),
        sql`${jobsTable.payload}->>'campaignId' = ${id}`,
      ),
      orderBy: [desc(jobsTable.createdAt)],
    });
    const prevPayload = prevJob?.payload as {
      campaignId?: string;
      productImageNoBgUrl?: string | null;
    } | null;
    if (prevPayload?.productImageNoBgUrl) {
      productImageNoBgUrl = prevPayload.productImageNoBgUrl;
    }

    await db
      .update(adAssetsTable)
      .set({ status: "pending", imageUrl: null })
      .where(eq(adAssetsTable.campaignId, id));

    const jobIds: string[] = [];
    for (let idx = 0; idx < 3; idx++) {
      const ad = updated.ads[idx];
      if (!ad) continue;
      const asset = await db.query.adAssetsTable.findFirst({
        where: and(
          eq(adAssetsTable.campaignId, id),
          eq(adAssetsTable.idx, idx),
        ),
      });
      if (!asset) continue;
      const jobId = generateId("job");
      jobIds.push(jobId);
      await db.insert(jobsTable).values({
        id: jobId,
        type: "generate_image",
        payload: {
          campaignId: id,
          adAssetId: asset.id,
          idx,
          ad,
          brandName: updated.brandName,
          productImageUrl: campaign.productImageUrl,
          productImageNoBgUrl,
        },
        status: JOB_STATUS.pending,
      });
    }
    runInBackground(
      processPendingJobs(3, { jobIds }).catch((err) => {
        logger.error({ err, campaignId: id }, "Image job drain after revise failed");
      }),
    );
  }

  const fresh = await getCampaignRecord(id);
  return toCampaignResponse(fresh!);
}

/**
 * Begin publishing a campaign: creates a Stripe Checkout session (which is what
 * actually charges the user and, on completion, publishes live ads) and marks
 * the campaign as `publishing`. Returns the checkout URL.
 */
export async function publishCampaignById(
  id: string,
  opts: {
    dailyBudgetCents: number;
    metaSharePct: number;
    tiktokSharePct: number;
    googleSharePct?: number;
    successUrl?: string | null;
  },
): Promise<{
  checkoutUrl: string | null;
  adsMode: string;
  live: boolean;
  outcomes?: PublishOutcome[];
}> {
  const { dailyBudgetCents, metaSharePct, tiktokSharePct, googleSharePct, successUrl } = opts;

  if (!dailyBudgetCents || metaSharePct == null || tiktokSharePct == null) {
    throw new ServiceError(
      400,
      "missing_params",
      "dailyBudgetCents, metaSharePct, tiktokSharePct required",
    );
  }

  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  if (!campaign.campaignJson) {
    throw new ServiceError(400, "not_generated", "campaign not generated yet");
  }

  const mode = adsMode();
  const publishOpts: PublishOptions = {
    dailyBudgetCents,
    metaSharePct,
    tiktokSharePct,
    googleSharePct: resolveGoogleSharePct(metaSharePct, tiktokSharePct, googleSharePct),
  };

  // Mock (and any non-live mode) publishes through MockAdPlatform — no Stripe,
  // no real ad spend. Live mode still requires Checkout before ads go out.
  if (mode !== "live") {
    const { live, outcomes } = await publishCampaignToPlatforms(id, publishOpts);
    if (!live) {
      const errors = outcomes.map((o) => `${o.platform}: ${o.error ?? "failed"}`).join("; ");
      throw new ServiceError(502, "publish_failed", `Publishing failed — ${errors}`);
    }
    return { checkoutUrl: null, adsMode: mode, live: true, outcomes };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new ServiceError(500, "stripe_not_configured", "Stripe not configured");
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey);

  const cj = campaign.campaignJson as { brandName?: string };
  const brandName = cj.brandName ?? "LaunchPad Campaign";
  const origin = publicOrigin();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `LaunchPad — ${brandName}`,
            description: `Ad campaign + 10% service fee · Pause anytime`,
          },
          unit_amount: 2900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      campaignId: id,
      dailyBudgetCents: String(dailyBudgetCents),
      metaSharePct: String(metaSharePct),
      tiktokSharePct: String(tiktokSharePct),
      googleSharePct: String(resolveGoogleSharePct(metaSharePct, tiktokSharePct, googleSharePct)),
    },
    success_url: successUrl ?? `${origin}/?success=true&campaignId=${id}`,
    cancel_url: `${origin}/?campaignId=${id}`,
  });

  await db
    .update(campaignsTable)
    .set({ status: "publishing" })
    .where(eq(campaignsTable.id, id));

  return { checkoutUrl: session.url, adsMode: mode, live: false };
}

/**
 * Pause a live campaign across all platforms it was published to. `reason`
 * records who/what paused it: "user" (client), "admin", or "budget_cap"
 * (automatic spend guard).
 */
export async function pauseCampaignById(
  id: string,
  reason: "user" | "admin" | "budget_cap" = "user",
) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  if (campaign.status !== "live") {
    // Guard the status machine: pausing anything that isn't live (e.g. a
    // campaign sitting in the review queue) would strand it in a state with
    // no publishes to resume and no way back into review.
    throw new ServiceError(409, "not_live", "Only live campaigns can be paused");
  }

  const publishes = await db.query.publishesTable.findMany({
    where: and(
      eq(publishesTable.campaignId, id),
      eq(publishesTable.status, "active"),
    ),
  });

  const failedPlatforms: string[] = [];
  for (const pub of publishes) {
    if (!pub.externalCampaignId) continue;
    try {
      const { adPlatform } = await getAdPlatformForCampaign(
        pub.platform as "meta" | "tiktok" | "google",
        campaign,
        { useSnapshot: true, allowUnclaimedHouse: !campaign.userId },
      );
      await adPlatform.pauseCampaign(pub.externalCampaignId);
      await db
        .update(publishesTable)
        .set({ status: "paused" })
        .where(eq(publishesTable.id, pub.id));
    } catch (err) {
      logger.error({ err, publishId: pub.id }, "Error pausing platform");
      failedPlatforms.push(pub.platform);
    }
  }

  if (failedPlatforms.length > 0) {
    // Do NOT mark the campaign paused: ads are still running on at least one
    // platform. Keeping status "live" means the spend guard keeps monitoring
    // it and will retry the pause on its next tick, so the budget cap stays
    // enforced even through transient platform API failures.
    throw new ServiceError(
      502,
      "pause_incomplete",
      `Could not pause on: ${failedPlatforms.join(", ")}. The campaign is still live; it will be retried automatically.`,
    );
  }

  await db
    .update(campaignsTable)
    .set({ status: "paused", pausedReason: reason })
    .where(eq(campaignsTable.id, id));

  const fresh = await getCampaignRecord(id);
  return toCampaignResponse(fresh!);
}

/**
 * Resume a paused campaign: reactivate every paused publish on its platform,
 * then mark the campaign live again. Refuses to resume a campaign that was
 * auto-paused for hitting its budget cap unless the cap has since been raised.
 */
export async function resumeCampaignById(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  if (campaign.status !== "paused") {
    throw new ServiceError(409, "not_paused", "Only paused campaigns can be resumed");
  }

  if (campaign.budgetCapCents != null) {
    const spent = await getLifetimeSpendCents(id);
    if (spent >= campaign.budgetCapCents) {
      throw new ServiceError(
        409,
        "budget_cap_reached",
        "Spend has reached the budget cap. Raise the cap before resuming.",
      );
    }
  }

  const publishes = await db.query.publishesTable.findMany({
    where: and(
      eq(publishesTable.campaignId, id),
      eq(publishesTable.status, "paused"),
    ),
  });
  if (publishes.length === 0) {
    throw new ServiceError(409, "nothing_to_resume", "No paused platform publishes found");
  }

  let resumed = 0;
  for (const pub of publishes) {
    if (!pub.externalCampaignId) continue;
    try {
      const { adPlatform } = await getAdPlatformForCampaign(
        pub.platform as "meta" | "tiktok" | "google",
        campaign,
        { useSnapshot: true, allowUnclaimedHouse: !campaign.userId },
      );
      await adPlatform.resumeCampaign(pub.externalCampaignId);
      await db
        .update(publishesTable)
        .set({ status: "active" })
        .where(eq(publishesTable.id, pub.id));
      resumed += 1;
    } catch (err) {
      logger.error({ err, publishId: pub.id }, "Error resuming platform");
    }
  }

  if (resumed === 0) {
    throw new ServiceError(502, "resume_failed", "Could not resume on any platform");
  }

  await db
    .update(campaignsTable)
    .set({ status: "live", pausedReason: null })
    .where(eq(campaignsTable.id, id));

  const fresh = await getCampaignRecord(id);
  return toCampaignResponse(fresh!);
}

/**
 * Admin approval: publish a reviewed campaign to the ad platforms using the
 * options the client chose at checkout (persisted on the campaign row by the
 * Stripe webhook). Marks the campaign live on success.
 */
export async function approveCampaignById(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  if (campaign.status !== "in_review") {
    throw new ServiceError(
      409,
      "not_in_review",
      `Campaign is "${campaign.status}", not in review`,
    );
  }

  const opts = campaign.pendingPublishJson as PublishOptions | null;
  if (!opts?.dailyBudgetCents) {
    throw new ServiceError(
      400,
      "missing_publish_options",
      "No stored publish options — cannot approve",
    );
  }

  // Atomic compare-and-set to a transitional status so two concurrent
  // approvals (e.g. two admin tabs) can't both publish and create duplicate
  // real-money campaigns on the ad platforms.
  const claimed = await db
    .update(campaignsTable)
    .set({ status: "publishing" })
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.status, "in_review")))
    .returning({ id: campaignsTable.id });
  if (claimed.length === 0) {
    throw new ServiceError(409, "not_in_review", "Campaign is no longer in review");
  }

  try {
    const { live, outcomes } = await publishCampaignToPlatforms(id, opts);
    if (!live) {
      // Put it back in the queue so the admin can retry after fixing the issue.
      await db
        .update(campaignsTable)
        .set({ status: "in_review" })
        .where(and(eq(campaignsTable.id, id), eq(campaignsTable.status, "publishing")));
      const errors = outcomes.map((o) => `${o.platform}: ${o.error ?? "failed"}`).join("; ");
      throw new ServiceError(502, "publish_failed", `Publishing failed — ${errors}`);
    }

    const fresh = await getCampaignRecord(id);
    return { campaign: toCampaignResponse(fresh!), outcomes };
  } catch (err) {
    if (!(err instanceof ServiceError)) {
      await db
        .update(campaignsTable)
        .set({ status: "in_review" })
        .where(and(eq(campaignsTable.id, id), eq(campaignsTable.status, "publishing")));
    }
    throw err;
  }
}

/** Admin rejection: campaign never goes live; the reason is shown to the client. */
export async function rejectCampaignById(id: string, reason: string) {
  const trimmed = reason?.trim();
  if (!trimmed) {
    throw new ServiceError(400, "missing_reason", "A rejection reason is required");
  }

  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  if (campaign.status !== "in_review") {
    throw new ServiceError(
      409,
      "not_in_review",
      `Campaign is "${campaign.status}", not in review`,
    );
  }

  await db
    .update(campaignsTable)
    .set({ status: "rejected", rejectionReason: trimmed })
    .where(eq(campaignsTable.id, id));

  const fresh = await getCampaignRecord(id);
  return toCampaignResponse(fresh!);
}

/** Admin: set or raise/lower the total spend cap for a campaign. */
export async function setBudgetCap(id: string, budgetCapCents: number) {
  if (!Number.isInteger(budgetCapCents) || budgetCapCents <= 0) {
    throw new ServiceError(400, "invalid_cap", "budgetCapCents must be a positive integer");
  }

  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");

  await db
    .update(campaignsTable)
    .set({ budgetCapCents })
    .where(eq(campaignsTable.id, id));

  const fresh = await getCampaignRecord(id);
  return toCampaignResponse(fresh!);
}

/** Live metrics for a campaign (zeros if it is not live). */
export async function getCampaignMetrics(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");

  const lifetimeSpendCents =
    campaign.status === "live" || campaign.status === "paused"
      ? await getLifetimeSpendCents(id)
      : null;
  const budgetCapCents = campaign.budgetCapCents ?? null;

  if (campaign.status === "live") {
    const publishes = await db.query.publishesTable.findMany({
      where: and(
        eq(publishesTable.campaignId, id),
        eq(publishesTable.status, "active"),
      ),
    });

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpendCents = 0;

    for (const pub of publishes) {
      if (!pub.externalCampaignId) continue;
      try {
        const { adPlatform } = await getAdPlatformForCampaign(
          pub.platform as "meta" | "tiktok" | "google",
          campaign,
          { useSnapshot: true, allowUnclaimedHouse: !campaign.userId },
        );
        const m = await adPlatform.getMetrics(pub.externalCampaignId);
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalSpendCents += m.spendCents;
      } catch (err) {
        logger.warn({ err, publishId: pub.id }, "Error fetching metrics");
      }
    }

    return {
      campaignId: id,
      impressions: totalImpressions,
      clicks: totalClicks,
      spendCents: totalSpendCents,
      lifetimeSpendCents,
      budgetCapCents,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    campaignId: id,
    impressions: 0,
    clicks: 0,
    spendCents: 0,
    lifetimeSpendCents,
    budgetCapCents,
    updatedAt: new Date().toISOString(),
  };
}
