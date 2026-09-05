import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { getReferenceLibrary } from "../lib/referenceLibrary.js";
import {
  REFERENCE_PLATFORMS,
  isValidPlatform,
  ingestReferenceImage,
  listReferenceAssets,
  deleteReferenceAsset,
  seedReferenceLibrary,
} from "../lib/referenceAssets.js";
import { connectorStatuses, adsMode, CONNECTOR_SPECS } from "../ads/connectors.js";
import { saveCredentials, deleteCredentials } from "../ads/credentials.js";
import { verifyConnector } from "../ads/verify.js";
import {
  HUMAN_ONBOARDING_STEPS,
  listClientAdAccounts,
  publicClientView,
  upsertClientAdAccount,
  type ClientAdAccountInput,
} from "../ads/clientAccounts.js";
import {
  isAccessStatus,
  parseClientAccountIds,
  parsePublishedSnapshot,
  previewClientReadiness,
} from "../ads/accountTarget.js";
import { resolveGoogleSharePct } from "../lib/channelSplit.js";
import { db, campaignsTable, usersTable, publishesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  ServiceError,
  approveCampaignById,
  rejectCampaignById,
  pauseCampaignById,
  resumeCampaignById,
  setBudgetCap,
  getLifetimeSpendCents,
} from "../lib/campaignService.js";
import { logger } from "../lib/logger.js";

const router = Router();

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Lightweight in-memory throttle for the single-password login endpoint. Memory
// resets on restart (acceptable for a throttle); only slows online guessing.
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  if (loginAttempts.size > 500) {
    for (const [k, v] of loginAttempts) if (now > v.resetAt) loginAttempts.delete(k);
  }
  const rec = loginAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_LOGIN_ATTEMPTS;
}

function adminSecret(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw && pw.length > 0 ? pw : null;
}

/** Constant-time string compare via fixed-length digests (avoids length leak). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Token = `${exp}.${hmac(exp)}`. Signed with ADMIN_PASSWORD so it survives the
 * api-server's frequent dev restarts (no in-memory store), carries an expiry,
 * and is not reversible to the password.
 */
function createAdminToken(secret: string): string {
  const payload = String(Date.now() + TOKEN_TTL_MS);
  return `${payload}.${sign(payload, secret)}`;
}

function verifyAdminToken(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[a-f0-9]{64}$/i.test(sig)) return false; // hex sha256 hmac; reject malformed before compare
  const expected = sign(payload, secret);
  if (sig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}

// GET /api/admin/status — unauthenticated. Tells the login screen whether
// ADMIN_PASSWORD exists. Never returns the password or connector values.
router.get("/status", (_req: Request, res: Response) => {
  return res.json({ configured: Boolean(adminSecret()), adsMode: adsMode() });
});

// POST /api/admin/login — exchange the admin password for a short-lived token.
router.post("/login", (req: Request, res: Response) => {
  const secret = adminSecret();
  if (!secret) {
    return res.status(503).json({ error: "Admin access is not configured." });
  }
  const ip = req.ip || "unknown";
  if (loginRateLimited(ip)) {
    return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  }
  const { password } = (req.body ?? {}) as { password?: unknown };
  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: "Password required." });
  }
  if (!safeEqual(password, secret)) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  loginAttempts.delete(ip);
  return res.json({ token: createAdminToken(secret), expiresInMs: TOKEN_TTL_MS });
});

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = adminSecret();
  if (!secret) {
    return res.status(503).json({ error: "Admin access is not configured." });
  }
  const token = req.header("x-admin-token") ?? undefined;
  if (!verifyAdminToken(token, secret)) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  return next();
}

// GET /api/admin/connectors — ad-platform connection status, gated.
// Returns only secret KEY NAMES and boolean presence — never secret values.
router.get("/connectors", requireAdmin, async (_req: Request, res: Response) => {
  return res.json({ adsMode: adsMode(), connectors: await connectorStatuses() });
});

// POST /api/admin/connectors/:platform — save credentials for a platform.
// Values are encrypted at rest. Only declared keys are accepted; blank values
// are ignored (so editing one field never wipes the others). We never echo the
// values back, and saving does NOT change ADS_MODE — publishing stays in mock
// until ADS_MODE is set to "live".
router.post("/connectors/:platform", requireAdmin, async (req: Request, res: Response) => {
  const platform = String(req.params.platform);
  const spec = CONNECTOR_SPECS.find((s) => s.id === platform);
  if (!spec || !spec.v1) return res.status(404).json({ error: "Unknown connector." });

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ error: "Admin password is not configured." });
  }

  const allowed = [...spec.requiredSecretKeys, ...spec.optionalSecretKeys];
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const source = (raw.values && typeof raw.values === "object" ? raw.values : raw) as Record<
    string,
    unknown
  >;

  const incoming: Record<string, string> = {};
  for (const key of allowed) {
    const v = source[key];
    if (typeof v === "string" && v.trim().length > 0) incoming[key] = v.trim();
  }
  if (platform === "meta") {
    const alias = source.META_AD_ACCOUNT_ID;
    if (typeof alias === "string" && alias.trim().length > 0 && !incoming.META_BUSINESS_ID) {
      incoming.META_BUSINESS_ID = alias.trim();
    }
  }
  if (Object.keys(incoming).length === 0) {
    return res.status(400).json({ error: "Provide at least one credential value to save." });
  }

  try {
    await saveCredentials(platform, incoming, allowed);
    // Saving credentials must NEVER flip ADS_MODE.
    return res.json({ ok: true, adsMode: adsMode(), connectors: await connectorStatuses() });
  } catch (err) {
    logger.error({ err, platform }, "Failed to save connector credentials");
    return res.status(500).json({ error: "Couldn't save credentials." });
  }
});

// DELETE /api/admin/connectors/:platform — remove stored credentials for a
// platform. Credentials set via environment variables are unaffected.
router.delete("/connectors/:platform", requireAdmin, async (req: Request, res: Response) => {
  const platform = String(req.params.platform);
  const spec = CONNECTOR_SPECS.find((s) => s.id === platform);
  if (!spec || !spec.v1) return res.status(404).json({ error: "Unknown connector." });

  try {
    await deleteCredentials(platform);
    return res.json({ ok: true, adsMode: adsMode(), connectors: await connectorStatuses() });
  } catch (err) {
    logger.error({ err, platform }, "Failed to delete connector credentials");
    return res.status(500).json({ error: "Couldn't disconnect credentials." });
  }
});

// POST /api/admin/connectors/:platform/verify — read-only authenticate.
// Does not publish, does not spend, does not change ADS_MODE.
router.post("/connectors/:platform/verify", requireAdmin, async (req: Request, res: Response) => {
  const platform = String(req.params.platform);
  const spec = CONNECTOR_SPECS.find((s) => s.id === platform);
  if (!spec || !spec.v1) return res.status(404).json({ error: "Unknown connector." });
  const modeBefore = adsMode();
  const result = await verifyConnector(platform);
  if (adsMode() !== modeBefore) {
    logger.error({ platform }, "ADS_MODE changed during verify — this is a bug");
  }
  return res.json(result);
});

// GET /api/admin/clients — per-customer ad account IDs (identifiers, never tokens).
router.get("/clients", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const clients = await listClientAdAccounts();
    return res.json({
      adsMode: adsMode(),
      humanSteps: HUMAN_ONBOARDING_STEPS,
      clients: clients.map(publicClientView),
    });
  } catch (err) {
    logger.error({ err }, "Failed to list client ad accounts");
    return res.status(500).json({ error: "Couldn't load client ad accounts." });
  }
});

// PUT /api/admin/clients/:userId — save per-customer IDs and access-step status.
// Does not change ADS_MODE. Does not accept tokens.
router.put("/clients/:userId", requireAdmin, async (req: Request, res: Response) => {
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) return res.status(400).json({ error: "userId required." });

  const raw = (req.body ?? {}) as Record<string, unknown>;
  const incoming: ClientAdAccountInput = {};
  if (typeof raw.isHouse === "boolean") incoming.isHouse = raw.isHouse;
  if ("metaAdAccountId" in raw) {
    incoming.metaAdAccountId = typeof raw.metaAdAccountId === "string" ? raw.metaAdAccountId : null;
  }
  if ("metaPageId" in raw) {
    incoming.metaPageId = typeof raw.metaPageId === "string" ? raw.metaPageId : null;
  }
  if ("metaClientBusinessId" in raw) {
    incoming.metaClientBusinessId =
      typeof raw.metaClientBusinessId === "string" ? raw.metaClientBusinessId : null;
  }
  if ("tiktokAdvertiserId" in raw) {
    incoming.tiktokAdvertiserId =
      typeof raw.tiktokAdvertiserId === "string" ? raw.tiktokAdvertiserId : null;
  }
  if ("tiktokIdentityId" in raw) {
    incoming.tiktokIdentityId =
      typeof raw.tiktokIdentityId === "string" ? raw.tiktokIdentityId : null;
  }
  if ("googleCustomerId" in raw) {
    incoming.googleCustomerId =
      typeof raw.googleCustomerId === "string" ? raw.googleCustomerId : null;
  }
  if (isAccessStatus(raw.metaBoboStatus)) incoming.metaBoboStatus = raw.metaBoboStatus;
  if (isAccessStatus(raw.tiktokPartnerStatus)) {
    incoming.tiktokPartnerStatus = raw.tiktokPartnerStatus;
  }
  if (isAccessStatus(raw.googleMccLinkStatus)) {
    incoming.googleMccLinkStatus = raw.googleMccLinkStatus;
  }

  try {
    const saved = await upsertClientAdAccount(userId, incoming);
    return res.json({
      ok: true,
      adsMode: adsMode(),
      client: publicClientView(saved),
    });
  } catch (err) {
    logger.error({ err, userId }, "Failed to save client ad account");
    return res.status(500).json({ error: "Couldn't save client ad account." });
  }
});

// PATCH /api/admin/campaigns/:id/ad-accounts — per-campaign override + house-test flag.
router.patch("/campaigns/:id/ad-accounts", requireAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, id),
  });
  if (!campaign) return res.status(404).json({ error: "Campaign not found." });

  const raw = (req.body ?? {}) as Record<string, unknown>;
  const clientIncoming: ClientAdAccountInput = {};
  const override: Record<string, string> = {};
  const take = (key: keyof ClientAdAccountInput, rawKey: string) => {
    const nested =
      raw.adAccountJson && typeof raw.adAccountJson === "object"
        ? (raw.adAccountJson as Record<string, unknown>)
        : null;
    if (!(rawKey in raw) && !(nested && rawKey in nested)) return;
    const v = nested && rawKey in nested ? nested[rawKey] : raw[rawKey];
    if (typeof v === "string") {
      (clientIncoming as Record<string, string | null>)[key] = v;
      if (v.trim()) override[rawKey] = v.trim();
    }
  };
  take("metaAdAccountId", "metaAdAccountId");
  take("metaPageId", "metaPageId");
  take("metaClientBusinessId", "metaClientBusinessId");
  take("tiktokAdvertiserId", "tiktokAdvertiserId");
  take("tiktokIdentityId", "tiktokIdentityId");
  take("googleCustomerId", "googleCustomerId");

  try {
    if (campaign.userId && Object.keys(clientIncoming).length > 0 && raw.isHouseTest !== true) {
      await upsertClientAdAccount(campaign.userId, clientIncoming);
    }

    await db
      .update(campaignsTable)
      .set({
        ...(typeof raw.isHouseTest === "boolean" ? { isHouseTest: raw.isHouseTest } : {}),
        ...(Object.keys(override).length > 0 || raw.adAccountJson !== undefined
          ? { adAccountJson: { ...(parseClientAccountIds(campaign.adAccountJson) ?? {}), ...override } }
          : {}),
      })
      .where(eq(campaignsTable.id, id));

    return res.json({ ok: true, adsMode: adsMode() });
  } catch (err) {
    logger.error({ err, campaignId: id }, "Failed to save campaign ad accounts");
    return res.status(500).json({ error: "Couldn't save ad accounts." });
  }
});

// GET /api/admin/reference-library — the curated reference library, gated.
router.get("/reference-library", requireAdmin, (_req: Request, res: Response) => {
  return res.json(getReferenceLibrary());
});

// GET /api/admin/reference-assets — real ad-creative corpus (curated + uploaded).
router.get("/reference-assets", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const assets = await listReferenceAssets();
    return res.json({ platforms: REFERENCE_PLATFORMS, assets });
  } catch (err) {
    logger.error({ err }, "Failed to list reference assets");
    return res.status(500).json({ error: "Failed to load reference assets." });
  }
});

// POST /api/admin/reference-assets — upload + index a new reference image.
router.post("/reference-assets", requireAdmin, async (req: Request, res: Response) => {
  const { platform, dataUrl, title } = (req.body ?? {}) as {
    platform?: unknown;
    dataUrl?: unknown;
    title?: unknown;
  };

  if (!isValidPlatform(platform)) {
    return res.status(400).json({ error: "Invalid platform." });
  }
  if (typeof dataUrl !== "string") {
    return res.status(400).json({ error: "dataUrl required." });
  }
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) return res.status(400).json({ error: "Invalid image data." });

  const buffer = Buffer.from(match[2] ?? "", "base64");
  if (buffer.length === 0) return res.status(400).json({ error: "Empty image." });
  // Stay under the express.json() body limit (10mb) once base64 overhead is added.
  if (buffer.length > 7 * 1024 * 1024) {
    return res.status(400).json({ error: "Image too large (max 7MB)." });
  }

  try {
    const asset = await ingestReferenceImage({
      platform,
      source: "uploaded",
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 160) : null,
      buffer,
    });
    return res.status(201).json(asset);
  } catch (err) {
    logger.error({ err }, "Reference asset upload failed");
    return res.status(500).json({ error: "Upload failed." });
  }
});

// DELETE /api/admin/reference-assets/:id — remove an asset from the corpus.
router.delete("/reference-assets/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const ok = await deleteReferenceAsset(String(req.params.id));
    if (!ok) return res.status(404).json({ error: "Not found." });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Reference asset delete failed");
    return res.status(500).json({ error: "Delete failed." });
  }
});

// POST /api/admin/reference-assets/seed — (re)populate curated examples. Idempotent.
router.post("/reference-assets/seed", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await seedReferenceLibrary();
    return res.json(result);
  } catch (err) {
    logger.error({ err }, "Reference seed failed");
    return res.status(500).json({ error: "Seed failed." });
  }
});

// ---------------------------------------------------------------------------
// Client campaign management. Client brands publish to per-customer ad
// accounts (BOBO / partner / MCC). House env IDs are LaunchPad tests only.
// ---------------------------------------------------------------------------

function handleServiceError(res: Response, err: unknown) {
  if (err instanceof ServiceError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  logger.error({ err }, "Admin campaign action failed");
  return res.status(500).json({ error: "Internal error" });
}

// GET /api/admin/campaigns — full roster: review queue + live/paused/rejected
router.get("/campaigns", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const campaigns = await db.query.campaignsTable.findMany({
      orderBy: [desc(campaignsTable.createdAt)],
    });
    const users = await db.query.usersTable.findMany();
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    const allPublishes = await db.query.publishesTable.findMany();
    const clientRows = await listClientAdAccounts();
    const clientByUser = new Map(clientRows.map((r) => [r.userId, r]));

    const rows = await Promise.all(
      campaigns.map(async (c) => {
        const pubs = allPublishes.filter((p) => p.campaignId === c.id);
        const cj = c.campaignJson as { brandName?: string; tagline?: string } | null;
        const pending = c.pendingPublishJson as {
          dailyBudgetCents?: number;
          metaSharePct?: number;
          tiktokSharePct?: number;
          googleSharePct?: number;
        } | null;
        const hasSpend = c.status === "live" || c.status === "paused";
        const spendCents = hasSpend ? await getLifetimeSpendCents(c.id) : 0;
        const googleSharePct = pending
          ? resolveGoogleSharePct(
              pending.metaSharePct ?? 0,
              pending.tiktokSharePct ?? 0,
              pending.googleSharePct,
            )
          : null;
        const platformsForSplit: Array<"meta" | "tiktok" | "google"> = [];
        if ((pending?.metaSharePct ?? 0) > 0) platformsForSplit.push("meta");
        if ((pending?.tiktokSharePct ?? 0) > 0) platformsForSplit.push("tiktok");
        if ((googleSharePct ?? 0) > 0) platformsForSplit.push("google");
        if (platformsForSplit.length === 0) {
          platformsForSplit.push("meta", "tiktok", "google");
        }
        const client = c.userId ? (clientByUser.get(c.userId) ?? null) : null;
        const readiness = previewClientReadiness({
          isHouseTest: c.isHouseTest === true,
          userId: c.userId,
          client,
          campaignOverride: parseClientAccountIds(c.adAccountJson),
          publishedSnapshot: parsePublishedSnapshot(c.publishedAccountJson),
          platforms: platformsForSplit,
        });

        return {
          id: c.id,
          userId: c.userId,
          brandName: cj?.brandName ?? "Untitled",
          tagline: cj?.tagline ?? null,
          brief: c.brief,
          clientEmail: c.userId ? (emailById.get(c.userId) ?? null) : null,
          status: c.status,
          riskFlags: c.riskFlagsJson ?? null,
          rejectionReason: c.rejectionReason,
          pausedReason: c.pausedReason,
          dailyBudgetCents: pending?.dailyBudgetCents ?? null,
          metaSharePct: pending?.metaSharePct ?? null,
          tiktokSharePct: pending?.tiktokSharePct ?? null,
          googleSharePct: pending?.googleSharePct ?? googleSharePct,
          budgetCapCents: c.budgetCapCents,
          spendCents,
          landingSlug: c.landingSlug,
          platforms: pubs.map((p) => ({ platform: p.platform, status: p.status })),
          createdAt: c.createdAt.toISOString(),
          isHouseTest: c.isHouseTest === true,
          accountScope: readiness.scope,
          accountIds: readiness.ids,
          accountAccess: readiness.access,
          missingAccountIds: readiness.missing,
        };
      }),
    );

    return res.json({ campaigns: rows });
  } catch (err) {
    logger.error({ err }, "Admin campaigns list failed");
    return res.status(500).json({ error: "Couldn't load campaigns." });
  }
});

// POST /api/admin/campaigns/:id/approve — publish with the stored checkout options
router.post("/campaigns/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await approveCampaignById(String(req.params.id));
    return res.json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /api/admin/campaigns/:id/reject — { reason } shown to the client
router.post("/campaigns/:id/reject", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason } = (req.body ?? {}) as { reason?: string };
    const result = await rejectCampaignById(String(req.params.id), reason ?? "");
    return res.json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /api/admin/campaigns/:id/pause
router.post("/campaigns/:id/pause", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pauseCampaignById(String(req.params.id), "admin");
    return res.json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// POST /api/admin/campaigns/:id/resume
router.post("/campaigns/:id/resume", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await resumeCampaignById(String(req.params.id));
    return res.json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

// PATCH /api/admin/campaigns/:id/budget-cap — { budgetCapCents }
router.patch("/campaigns/:id/budget-cap", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { budgetCapCents } = (req.body ?? {}) as { budgetCapCents?: number };
    const result = await setBudgetCap(String(req.params.id), Number(budgetCapCents));
    return res.json(result);
  } catch (err) {
    return handleServiceError(res, err);
  }
});

export default router;
