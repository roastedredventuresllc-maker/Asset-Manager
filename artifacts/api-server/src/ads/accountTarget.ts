import { normalizeMetaAdAccountId } from "./metaAccount.js";
import { normalizeGoogleCustomerId } from "./googleCustomer.js";
import type { AdPlatformId } from "./types.js";
import type { CredentialValues } from "./credentials.js";

/**
 * Per-customer vs house account selection.
 *
 * House META_*, TIKTOK_*, and GOOGLE_* credentials (env or admin store) are LaunchPad's
 * own test campaigns only. Client brands publish to stored per-client IDs using
 * LaunchPad's system-user / partner / MCC credentials.
 */

export type AccessStatus = "none" | "requested" | "granted";
export type PublishScope = "house" | "client";

export const ACCESS_STATUSES: AccessStatus[] = ["none", "requested", "granted"];

export function isAccessStatus(v: unknown): v is AccessStatus {
  return v === "none" || v === "requested" || v === "granted";
}

/** Human steps that still require an operator or the client. Names, not tokens. */
export const HUMAN_ONBOARDING_STEPS = {
  meta: [
    {
      id: "confirm_client_bm",
      name: "Confirm client Business Manager and Ad Account",
    },
    {
      id: "request_bobo",
      name: "Request Business On Behalf Of access",
    },
    {
      id: "bobo_consent",
      name: "Client BM admin accepts the On Behalf Of request",
    },
    {
      id: "store_meta_ids",
      name: "Store client Ad Account ID and Page ID in LaunchPad",
    },
  ],
  tiktok: [
    {
      id: "confirm_client_advertiser",
      name: "Confirm client-owned TikTok advertiser",
    },
    {
      id: "partner_request",
      name: "Send TikTok partner access request",
    },
    {
      id: "partner_accept",
      name: "Client accepts partner access",
    },
    {
      id: "store_tiktok_ids",
      name: "Store Advertiser ID and CUSTOMIZED_USER Identity ID",
    },
  ],
  google: [
    {
      id: "mcc_invite",
      name: "Send MCC manager invitation to the client Customer ID",
    },
    {
      id: "mcc_accept",
      name: "Client accepts the manager invitation",
    },
    {
      id: "store_google_id",
      name: "Store client Customer ID (MCC remains the house login-customer-id)",
    },
  ],
} as const;

export class AccountIsolationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AccountIsolationError";
    this.code = code;
  }
}

export interface ClientAccountIds {
  metaAdAccountId?: string | null;
  metaPageId?: string | null;
  metaClientBusinessId?: string | null;
  tiktokAdvertiserId?: string | null;
  tiktokIdentityId?: string | null;
  googleCustomerId?: string | null;
}

export interface ClientAccountRecord extends ClientAccountIds {
  userId: string;
  isHouse: boolean;
  metaBoboStatus: AccessStatus;
  tiktokPartnerStatus: AccessStatus;
  googleMccLinkStatus: AccessStatus;
}

export interface HouseAccountIds {
  metaAdAccountId?: string;
  tiktokAdvertiserId?: string;
  googleCustomerId?: string;
  googleLoginCustomerId?: string;
}

export interface PublicAccountTarget {
  scope: PublishScope;
  metaAdAccountId?: string;
  metaPageId?: string;
  tiktokAdvertiserId?: string;
  tiktokIdentityId?: string;
  googleCustomerId?: string;
}

export interface SelectPublishTargetInput {
  isHouseTest: boolean;
  userId: string | null;
  /** Unclaimed local test-publish (no Stripe user). Never used for paid clients. */
  allowUnclaimedHouse: boolean;
  client: ClientAccountRecord | null;
  campaignOverride: ClientAccountIds | null;
  /** Snapshot from a previous publish; preferred for pause/metrics. */
  publishedSnapshot: PublicAccountTarget | null;
  house: HouseAccountIds;
  adsMode: string;
  platform: AdPlatformId;
}

export interface SelectedPublishTarget {
  scope: PublishScope;
  overlay: CredentialValues;
  publicTarget: PublicAccountTarget;
}

const CLIENT_OWNED_KEYS: Record<Exclude<AdPlatformId, "linkedin">, string[]> = {
  meta: ["META_BUSINESS_ID", "META_DEFAULT_PAGE_ID"],
  tiktok: ["TIKTOK_ADVERTISER_ID", "TIKTOK_IDENTITY_ID"],
  google: ["GOOGLE_ADS_CUSTOMER_ID"],
};

export function normalizeTikTokAdvertiserId(raw: string | undefined | null): string {
  return (raw ?? "").replace(/[^\d]/g, "").trim();
}

export function normalizeTikTokIdentityId(raw: string | undefined | null): string {
  return (raw ?? "").trim();
}

export function nonEmpty(raw: string | undefined | null): string | undefined {
  const v = (raw ?? "").trim();
  return v.length > 0 ? v : undefined;
}

export function pickId(
  ...candidates: Array<string | undefined | null>
): string | undefined {
  for (const c of candidates) {
    const v = nonEmpty(c);
    if (v) return v;
  }
  return undefined;
}

export function houseIdsFromCredentials(creds: {
  meta?: CredentialValues;
  tiktok?: CredentialValues;
  google?: CredentialValues;
}): HouseAccountIds {
  return {
    metaAdAccountId: normalizeMetaAdAccountId(creds.meta?.META_BUSINESS_ID) || undefined,
    tiktokAdvertiserId:
      normalizeTikTokAdvertiserId(creds.tiktok?.TIKTOK_ADVERTISER_ID) || undefined,
    googleCustomerId:
      normalizeGoogleCustomerId(creds.google?.GOOGLE_ADS_CUSTOMER_ID) || undefined,
    googleLoginCustomerId:
      normalizeGoogleCustomerId(creds.google?.GOOGLE_ADS_LOGIN_CUSTOMER_ID) || undefined,
  };
}

export function parseClientAccountIds(raw: unknown): ClientAccountIds | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ids: ClientAccountIds = {
    metaAdAccountId: typeof o.metaAdAccountId === "string" ? o.metaAdAccountId : null,
    metaPageId: typeof o.metaPageId === "string" ? o.metaPageId : null,
    metaClientBusinessId:
      typeof o.metaClientBusinessId === "string" ? o.metaClientBusinessId : null,
    tiktokAdvertiserId:
      typeof o.tiktokAdvertiserId === "string" ? o.tiktokAdvertiserId : null,
    tiktokIdentityId: typeof o.tiktokIdentityId === "string" ? o.tiktokIdentityId : null,
    googleCustomerId: typeof o.googleCustomerId === "string" ? o.googleCustomerId : null,
  };
  return ids;
}

export function parsePublishedSnapshot(raw: unknown): PublicAccountTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.scope !== "house" && o.scope !== "client") return null;
  return {
    scope: o.scope,
    metaAdAccountId: typeof o.metaAdAccountId === "string" ? o.metaAdAccountId : undefined,
    metaPageId: typeof o.metaPageId === "string" ? o.metaPageId : undefined,
    tiktokAdvertiserId:
      typeof o.tiktokAdvertiserId === "string" ? o.tiktokAdvertiserId : undefined,
    tiktokIdentityId:
      typeof o.tiktokIdentityId === "string" ? o.tiktokIdentityId : undefined,
    googleCustomerId:
      typeof o.googleCustomerId === "string" ? o.googleCustomerId : undefined,
  };
}

export function mergeClientIds(
  base: ClientAccountIds | null,
  override: ClientAccountIds | null,
): ClientAccountIds {
  return {
    metaAdAccountId: pickId(override?.metaAdAccountId, base?.metaAdAccountId) ?? null,
    metaPageId: pickId(override?.metaPageId, base?.metaPageId) ?? null,
    metaClientBusinessId:
      pickId(override?.metaClientBusinessId, base?.metaClientBusinessId) ?? null,
    tiktokAdvertiserId:
      pickId(override?.tiktokAdvertiserId, base?.tiktokAdvertiserId) ?? null,
    tiktokIdentityId: pickId(override?.tiktokIdentityId, base?.tiktokIdentityId) ?? null,
    googleCustomerId: pickId(override?.googleCustomerId, base?.googleCustomerId) ?? null,
  };
}

export function resolvePublishScope(input: {
  isHouseTest: boolean;
  userId: string | null;
  allowUnclaimedHouse: boolean;
  clientIsHouse: boolean;
}): PublishScope {
  if (input.isHouseTest) return "house";
  if (input.clientIsHouse) return "house";
  if (!input.userId && input.allowUnclaimedHouse) return "house";
  return "client";
}

function assertNotHouseId(
  clientId: string,
  houseId: string | undefined,
  label: string,
): void {
  if (houseId && clientId === houseId) {
    throw new AccountIsolationError(
      "house_id_collision",
      `Client ${label} matches the LaunchPad house account. Client brands must not publish through house IDs.`,
    );
  }
}

function requiredClientIdsFor(
  platform: AdPlatformId,
  ids: ClientAccountIds,
): { overlay: CredentialValues; publicTarget: Partial<PublicAccountTarget>; missing: string[] } {
  const overlay: CredentialValues = {};
  const publicTarget: Partial<PublicAccountTarget> = {};
  const missing: string[] = [];

  if (platform === "linkedin") {
    throw new AccountIsolationError("linkedin_out_of_scope", "LinkedIn is out of v1.");
  }

  if (platform === "meta") {
    const adAccountId = normalizeMetaAdAccountId(ids.metaAdAccountId);
    const pageId = nonEmpty(ids.metaPageId);
    if (!adAccountId) missing.push("Meta Ad Account ID");
    if (!pageId) missing.push("Meta Page ID");
    if (adAccountId) {
      overlay.META_BUSINESS_ID = adAccountId;
      publicTarget.metaAdAccountId = adAccountId;
    }
    if (pageId) {
      overlay.META_DEFAULT_PAGE_ID = pageId;
      publicTarget.metaPageId = pageId;
    }
  }

  if (platform === "tiktok") {
    const advertiserId = normalizeTikTokAdvertiserId(ids.tiktokAdvertiserId);
    const identityId = normalizeTikTokIdentityId(ids.tiktokIdentityId);
    if (!advertiserId) missing.push("TikTok Advertiser ID");
    if (!identityId) missing.push("TikTok CUSTOMIZED_USER Identity ID");
    if (advertiserId) {
      overlay.TIKTOK_ADVERTISER_ID = advertiserId;
      publicTarget.tiktokAdvertiserId = advertiserId;
    }
    if (identityId) {
      overlay.TIKTOK_IDENTITY_ID = identityId;
      publicTarget.tiktokIdentityId = identityId;
    }
  }

  if (platform === "google") {
    const customerId = normalizeGoogleCustomerId(ids.googleCustomerId);
    if (!customerId) missing.push("Google Ads Customer ID");
    if (customerId) {
      overlay.GOOGLE_ADS_CUSTOMER_ID = customerId;
      publicTarget.googleCustomerId = customerId;
    }
  }

  return { overlay, publicTarget, missing };
}

function liveAccessRequired(
  platform: AdPlatformId,
  client: ClientAccountRecord | null,
  adsMode: string,
): void {
  if (adsMode !== "live") return;
  if (platform === "meta" && client?.metaBoboStatus !== "granted") {
    throw new AccountIsolationError(
      "bobo_consent_required",
      "Live Meta publish needs Client BM admin accepts the On Behalf Of request.",
    );
  }
  if (platform === "tiktok" && client?.tiktokPartnerStatus !== "granted") {
    throw new AccountIsolationError(
      "tiktok_partner_required",
      "Live TikTok publish needs Client accepts partner access.",
    );
  }
  if (platform === "google" && client?.googleMccLinkStatus !== "granted") {
    throw new AccountIsolationError(
      "google_mcc_required",
      "Live Google publish needs Client accepts the manager invitation.",
    );
  }
}

/**
 * Choose the account IDs for one platform at publish/pause/metrics time.
 * Never returns house account IDs for a client-scoped campaign.
 */
export function selectPublishTarget(input: SelectPublishTargetInput): SelectedPublishTarget {
  if (input.platform === "linkedin") {
    throw new AccountIsolationError("linkedin_out_of_scope", "LinkedIn is out of v1.");
  }

  if (input.publishedSnapshot) {
    return targetFromSnapshot(input.publishedSnapshot, input.house, input.platform);
  }

  const scope = resolvePublishScope({
    isHouseTest: input.isHouseTest,
    userId: input.userId,
    allowUnclaimedHouse: input.allowUnclaimedHouse,
    clientIsHouse: input.client?.isHouse === true,
  });

  if (scope === "house") {
    return houseTarget(input.house, input.platform);
  }

  if (!input.userId && !input.campaignOverride) {
    throw new AccountIsolationError(
      "client_unassigned",
      "This campaign has no client. Assign per-customer ad account IDs, or mark it as a LaunchPad house test.",
    );
  }

  const merged = mergeClientIds(input.client, input.campaignOverride);
  const { overlay, publicTarget, missing } = requiredClientIdsFor(input.platform, merged);
  if (missing.length > 0) {
    throw new AccountIsolationError(
      "client_ids_missing",
      `Client ${platformLabel(input.platform)} IDs missing: ${missing.join(", ")}. House accounts cannot be used for client brands.`,
    );
  }

  if (input.platform === "meta" && overlay.META_BUSINESS_ID) {
    assertNotHouseId(overlay.META_BUSINESS_ID, input.house.metaAdAccountId, "Meta Ad Account ID");
  }
  if (input.platform === "tiktok" && overlay.TIKTOK_ADVERTISER_ID) {
    assertNotHouseId(
      overlay.TIKTOK_ADVERTISER_ID,
      input.house.tiktokAdvertiserId,
      "TikTok Advertiser ID",
    );
  }
  if (input.platform === "google" && overlay.GOOGLE_ADS_CUSTOMER_ID) {
    assertNotHouseId(
      overlay.GOOGLE_ADS_CUSTOMER_ID,
      input.house.googleCustomerId,
      "Google Ads Customer ID",
    );
    assertNotHouseId(
      overlay.GOOGLE_ADS_CUSTOMER_ID,
      input.house.googleLoginCustomerId,
      "Google Ads Customer ID (must not be the MCC)",
    );
  }

  liveAccessRequired(input.platform, input.client, input.adsMode);

  return {
    scope: "client",
    overlay,
    publicTarget: { scope: "client", ...publicTarget },
  };
}

function platformLabel(platform: AdPlatformId): string {
  if (platform === "meta") return "Meta";
  if (platform === "tiktok") return "TikTok";
  if (platform === "google") return "Google Ads";
  return platform;
}

function houseTarget(house: HouseAccountIds, platform: AdPlatformId): SelectedPublishTarget {
  const publicTarget: PublicAccountTarget = { scope: "house" };
  if (platform === "meta" && house.metaAdAccountId) {
    publicTarget.metaAdAccountId = house.metaAdAccountId;
  }
  if (platform === "tiktok" && house.tiktokAdvertiserId) {
    publicTarget.tiktokAdvertiserId = house.tiktokAdvertiserId;
  }
  if (platform === "google" && house.googleCustomerId) {
    publicTarget.googleCustomerId = house.googleCustomerId;
  }
  return { scope: "house", overlay: {}, publicTarget };
}

function targetFromSnapshot(
  snapshot: PublicAccountTarget,
  house: HouseAccountIds,
  platform: AdPlatformId,
): SelectedPublishTarget {
  if (snapshot.scope === "house") {
    return houseTarget(house, platform);
  }
  const ids: ClientAccountIds = {
    metaAdAccountId: snapshot.metaAdAccountId,
    metaPageId: snapshot.metaPageId,
    tiktokAdvertiserId: snapshot.tiktokAdvertiserId,
    tiktokIdentityId: snapshot.tiktokIdentityId,
    googleCustomerId: snapshot.googleCustomerId,
  };
  const { overlay, publicTarget, missing } = requiredClientIdsFor(platform, ids);
  if (missing.length > 0) {
    throw new AccountIsolationError(
      "client_ids_missing",
      `Stored publish target is missing ${missing.join(", ")}.`,
    );
  }
  if (platform === "meta" && overlay.META_BUSINESS_ID) {
    assertNotHouseId(overlay.META_BUSINESS_ID, house.metaAdAccountId, "Meta Ad Account ID");
  }
  if (platform === "tiktok" && overlay.TIKTOK_ADVERTISER_ID) {
    assertNotHouseId(
      overlay.TIKTOK_ADVERTISER_ID,
      house.tiktokAdvertiserId,
      "TikTok Advertiser ID",
    );
  }
  if (platform === "google" && overlay.GOOGLE_ADS_CUSTOMER_ID) {
    assertNotHouseId(
      overlay.GOOGLE_ADS_CUSTOMER_ID,
      house.googleCustomerId,
      "Google Ads Customer ID",
    );
    assertNotHouseId(
      overlay.GOOGLE_ADS_CUSTOMER_ID,
      house.googleLoginCustomerId,
      "Google Ads Customer ID (must not be the MCC)",
    );
  }
  return {
    scope: "client",
    overlay,
    publicTarget: { scope: "client", ...publicTarget },
  };
}

/** Merge house credentials with a client overlay. Overlay wins for client-owned keys only. */
export function applyAccountOverlay(
  platform: AdPlatformId,
  houseValues: CredentialValues,
  overlay: CredentialValues,
): CredentialValues {
  const merged: CredentialValues = { ...houseValues };
  const allowed =
    platform === "linkedin" ? [] : CLIENT_OWNED_KEYS[platform as Exclude<AdPlatformId, "linkedin">];
  for (const key of allowed) {
    const next = overlay[key];
    if (typeof next === "string" && next.trim().length > 0) {
      merged[key] = next.trim();
    }
  }
  return merged;
}

export function summarizeMissingIds(
  ids: ClientAccountIds,
  platforms: AdPlatformId[],
): string[] {
  const missing: string[] = [];
  for (const platform of platforms) {
    if (platform === "linkedin") continue;
    missing.push(...requiredClientIdsFor(platform, ids).missing);
  }
  return missing;
}

export function publicIdsFromClient(ids: ClientAccountIds): Omit<PublicAccountTarget, "scope"> {
  return {
    metaAdAccountId: normalizeMetaAdAccountId(ids.metaAdAccountId) || undefined,
    metaPageId: nonEmpty(ids.metaPageId),
    tiktokAdvertiserId: normalizeTikTokAdvertiserId(ids.tiktokAdvertiserId) || undefined,
    tiktokIdentityId: normalizeTikTokIdentityId(ids.tiktokIdentityId) || undefined,
    googleCustomerId: normalizeGoogleCustomerId(ids.googleCustomerId) || undefined,
  };
}

export function previewClientReadiness(input: {
  isHouseTest: boolean;
  userId: string | null;
  client: ClientAccountRecord | null;
  campaignOverride: ClientAccountIds | null;
  publishedSnapshot: PublicAccountTarget | null;
  platforms: AdPlatformId[];
}): {
  scope: PublishScope;
  ids: Omit<PublicAccountTarget, "scope">;
  missing: string[];
  access: {
    metaBoboStatus: AccessStatus;
    tiktokPartnerStatus: AccessStatus;
    googleMccLinkStatus: AccessStatus;
  };
} {
  const scope = resolvePublishScope({
    isHouseTest: input.isHouseTest,
    userId: input.userId,
    allowUnclaimedHouse: false,
    clientIsHouse: input.client?.isHouse === true,
  });
  const merged = mergeClientIds(input.client, input.campaignOverride);
  const fromSnap = input.publishedSnapshot;
  const ids = fromSnap
    ? {
        metaAdAccountId: fromSnap.metaAdAccountId,
        metaPageId: fromSnap.metaPageId,
        tiktokAdvertiserId: fromSnap.tiktokAdvertiserId,
        tiktokIdentityId: fromSnap.tiktokIdentityId,
        googleCustomerId: fromSnap.googleCustomerId,
      }
    : publicIdsFromClient(merged);
  const missing = scope === "house" ? [] : summarizeMissingIds(merged, input.platforms);
  return {
    scope,
    ids,
    missing,
    access: {
      metaBoboStatus: input.client?.metaBoboStatus ?? "none",
      tiktokPartnerStatus: input.client?.tiktokPartnerStatus ?? "none",
      googleMccLinkStatus: input.client?.googleMccLinkStatus ?? "none",
    },
  };
}
