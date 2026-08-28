import { eq } from "drizzle-orm";
import { db, clientAdAccountsTable } from "@workspace/db";
import { normalizeMetaAdAccountId } from "./metaAccount.js";
import { normalizeGoogleCustomerId } from "./googleCustomer.js";
import {
  ACCESS_STATUSES,
  HUMAN_ONBOARDING_STEPS,
  isAccessStatus,
  normalizeTikTokAdvertiserId,
  normalizeTikTokIdentityId,
  nonEmpty,
  type AccessStatus,
  type ClientAccountRecord,
} from "./accountTarget.js";

export { HUMAN_ONBOARDING_STEPS };

function rowToRecord(
  row: typeof clientAdAccountsTable.$inferSelect,
): ClientAccountRecord {
  return {
    userId: row.userId,
    isHouse: row.isHouse,
    metaAdAccountId: row.metaAdAccountId,
    metaPageId: row.metaPageId,
    metaClientBusinessId: row.metaClientBusinessId,
    metaBoboStatus: isAccessStatus(row.metaBoboStatus) ? row.metaBoboStatus : "none",
    tiktokAdvertiserId: row.tiktokAdvertiserId,
    tiktokIdentityId: row.tiktokIdentityId,
    tiktokPartnerStatus: isAccessStatus(row.tiktokPartnerStatus)
      ? row.tiktokPartnerStatus
      : "none",
    googleCustomerId: row.googleCustomerId,
    googleMccLinkStatus: isAccessStatus(row.googleMccLinkStatus)
      ? row.googleMccLinkStatus
      : "none",
  };
}

export async function loadClientAdAccount(
  userId: string | null | undefined,
): Promise<ClientAccountRecord | null> {
  if (!userId) return null;
  const row = await db.query.clientAdAccountsTable.findFirst({
    where: eq(clientAdAccountsTable.userId, userId),
  });
  return row ? rowToRecord(row) : null;
}

export interface ClientAdAccountInput {
  isHouse?: boolean;
  metaAdAccountId?: string | null;
  metaPageId?: string | null;
  metaClientBusinessId?: string | null;
  metaBoboStatus?: AccessStatus;
  tiktokAdvertiserId?: string | null;
  tiktokIdentityId?: string | null;
  tiktokPartnerStatus?: AccessStatus;
  googleCustomerId?: string | null;
  googleMccLinkStatus?: AccessStatus;
}

function statusOr(
  incoming: unknown,
  fallback: AccessStatus,
): AccessStatus {
  return isAccessStatus(incoming) ? incoming : fallback;
}

/** Persist per-client IDs. Identifiers only — never tokens. */
export async function upsertClientAdAccount(
  userId: string,
  incoming: ClientAdAccountInput,
): Promise<ClientAccountRecord> {
  const existing = await loadClientAdAccount(userId);
  const next = {
    userId,
    isHouse: incoming.isHouse ?? existing?.isHouse ?? false,
    metaAdAccountId:
      incoming.metaAdAccountId !== undefined
        ? normalizeMetaAdAccountId(incoming.metaAdAccountId) || null
        : (existing?.metaAdAccountId ?? null),
    metaPageId:
      incoming.metaPageId !== undefined
        ? nonEmpty(incoming.metaPageId) ?? null
        : (existing?.metaPageId ?? null),
    metaClientBusinessId:
      incoming.metaClientBusinessId !== undefined
        ? nonEmpty(incoming.metaClientBusinessId) ?? null
        : (existing?.metaClientBusinessId ?? null),
    metaBoboStatus: statusOr(incoming.metaBoboStatus, existing?.metaBoboStatus ?? "none"),
    tiktokAdvertiserId:
      incoming.tiktokAdvertiserId !== undefined
        ? normalizeTikTokAdvertiserId(incoming.tiktokAdvertiserId) || null
        : (existing?.tiktokAdvertiserId ?? null),
    tiktokIdentityId:
      incoming.tiktokIdentityId !== undefined
        ? normalizeTikTokIdentityId(incoming.tiktokIdentityId) || null
        : (existing?.tiktokIdentityId ?? null),
    tiktokPartnerStatus: statusOr(
      incoming.tiktokPartnerStatus,
      existing?.tiktokPartnerStatus ?? "none",
    ),
    googleCustomerId:
      incoming.googleCustomerId !== undefined
        ? normalizeGoogleCustomerId(incoming.googleCustomerId) || null
        : (existing?.googleCustomerId ?? null),
    googleMccLinkStatus: statusOr(
      incoming.googleMccLinkStatus,
      existing?.googleMccLinkStatus ?? "none",
    ),
    updatedAt: new Date(),
  };

  await db
    .insert(clientAdAccountsTable)
    .values(next)
    .onConflictDoUpdate({
      target: clientAdAccountsTable.userId,
      set: {
        isHouse: next.isHouse,
        metaAdAccountId: next.metaAdAccountId,
        metaPageId: next.metaPageId,
        metaClientBusinessId: next.metaClientBusinessId,
        metaBoboStatus: next.metaBoboStatus,
        tiktokAdvertiserId: next.tiktokAdvertiserId,
        tiktokIdentityId: next.tiktokIdentityId,
        tiktokPartnerStatus: next.tiktokPartnerStatus,
        googleCustomerId: next.googleCustomerId,
        googleMccLinkStatus: next.googleMccLinkStatus,
        updatedAt: next.updatedAt,
      },
    });

  const saved = await loadClientAdAccount(userId);
  return saved!;
}

export interface ClientAdAccountListRow extends ClientAccountRecord {
  email: string | null;
}

export async function listClientAdAccounts(): Promise<ClientAdAccountListRow[]> {
  const users = await db.query.usersTable.findMany();
  const rows = await db.query.clientAdAccountsTable.findMany();
  const byUser = new Map(rows.map((r) => [r.userId, rowToRecord(r)]));
  const seen = new Set<string>();
  const out: ClientAdAccountListRow[] = [];

  for (const user of users) {
    seen.add(user.id);
    const rec = byUser.get(user.id);
    out.push({
      userId: user.id,
      email: user.email,
      isHouse: rec?.isHouse ?? false,
      metaAdAccountId: rec?.metaAdAccountId ?? null,
      metaPageId: rec?.metaPageId ?? null,
      metaClientBusinessId: rec?.metaClientBusinessId ?? null,
      metaBoboStatus: rec?.metaBoboStatus ?? "none",
      tiktokAdvertiserId: rec?.tiktokAdvertiserId ?? null,
      tiktokIdentityId: rec?.tiktokIdentityId ?? null,
      tiktokPartnerStatus: rec?.tiktokPartnerStatus ?? "none",
      googleCustomerId: rec?.googleCustomerId ?? null,
      googleMccLinkStatus: rec?.googleMccLinkStatus ?? "none",
    });
  }

  for (const rec of byUser.values()) {
    if (seen.has(rec.userId)) continue;
    out.push({ ...rec, email: null });
  }

  out.sort((a, b) => {
    if (a.isHouse !== b.isHouse) return a.isHouse ? -1 : 1;
    return (a.email ?? a.userId).localeCompare(b.email ?? b.userId);
  });
  return out;
}

export function publicClientView(row: ClientAdAccountListRow | ClientAccountRecord) {
  return {
    userId: row.userId,
    email: "email" in row ? row.email : undefined,
    isHouse: row.isHouse,
    metaAdAccountId: row.metaAdAccountId ?? null,
    metaPageId: row.metaPageId ?? null,
    metaClientBusinessId: row.metaClientBusinessId ?? null,
    metaBoboStatus: row.metaBoboStatus,
    tiktokAdvertiserId: row.tiktokAdvertiserId ?? null,
    tiktokIdentityId: row.tiktokIdentityId ?? null,
    tiktokPartnerStatus: row.tiktokPartnerStatus,
    googleCustomerId: row.googleCustomerId ?? null,
    googleMccLinkStatus: row.googleMccLinkStatus,
  };
}

export { ACCESS_STATUSES };
