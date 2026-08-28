import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AccountIsolationError,
  HUMAN_ONBOARDING_STEPS,
  applyAccountOverlay,
  houseIdsFromCredentials,
  mergeClientIds,
  resolvePublishScope,
  selectPublishTarget,
  type ClientAccountRecord,
  type HouseAccountIds,
} from "./accountTarget.js";
import { adsMode } from "./connectors.js";

const here = dirname(fileURLToPath(import.meta.url));

const house: HouseAccountIds = {
  metaAdAccountId: "1111111111",
  tiktokAdvertiserId: "2222222222",
  googleCustomerId: "3333333333",
  googleLoginCustomerId: "4444444444",
};

const client: ClientAccountRecord = {
  userId: "usr_1",
  isHouse: false,
  metaAdAccountId: "5555555555",
  metaPageId: "page_client",
  metaClientBusinessId: "bm_client",
  metaBoboStatus: "granted",
  tiktokAdvertiserId: "6666666666",
  tiktokIdentityId: "id_custom_user",
  tiktokPartnerStatus: "granted",
  googleCustomerId: "7777777777",
  googleMccLinkStatus: "granted",
};

function select(
  overrides: Partial<Parameters<typeof selectPublishTarget>[0]> & {
    platform: Parameters<typeof selectPublishTarget>[0]["platform"];
  },
) {
  return selectPublishTarget({
    isHouseTest: false,
    userId: "usr_1",
    allowUnclaimedHouse: false,
    client,
    campaignOverride: null,
    publishedSnapshot: null,
    house,
    adsMode: "mock",
    ...overrides,
  });
}

test("client Meta publish overlays Ad Account ID and Page ID, keeps house token unused in overlay", () => {
  const t = select({ platform: "meta" });
  assert.equal(t.scope, "client");
  assert.equal(t.overlay.META_BUSINESS_ID, "5555555555");
  assert.equal(t.overlay.META_DEFAULT_PAGE_ID, "page_client");
  assert.equal(t.overlay.META_SYSTEM_USER_TOKEN, undefined);
  assert.equal(t.publicTarget.metaAdAccountId, "5555555555");
});

test("client TikTok publish requires CUSTOMIZED_USER identity and uses client advertiser", () => {
  const t = select({ platform: "tiktok" });
  assert.equal(t.overlay.TIKTOK_ADVERTISER_ID, "6666666666");
  assert.equal(t.overlay.TIKTOK_IDENTITY_ID, "id_custom_user");
  assert.equal(t.overlay.TIKTOK_ACCESS_TOKEN, undefined);
  assert.equal(t.overlay.TIKTOK_BC_ID, undefined);
});

test("client Google publish overlays Customer ID and never the MCC login-customer-id", () => {
  const t = select({ platform: "google" });
  assert.equal(t.overlay.GOOGLE_ADS_CUSTOMER_ID, "7777777777");
  assert.equal(t.overlay.GOOGLE_ADS_LOGIN_CUSTOMER_ID, undefined);
  const merged = applyAccountOverlay(
    "google",
    {
      GOOGLE_ADS_CUSTOMER_ID: "3333333333",
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: "4444444444",
      GOOGLE_ADS_DEVELOPER_TOKEN: "dev",
    },
    t.overlay,
  );
  assert.equal(merged.GOOGLE_ADS_CUSTOMER_ID, "7777777777");
  assert.equal(merged.GOOGLE_ADS_LOGIN_CUSTOMER_ID, "4444444444");
  assert.equal(merged.GOOGLE_ADS_DEVELOPER_TOKEN, "dev");
});

test("applyAccountOverlay cannot replace house OAuth or MCC keys from a malicious overlay", () => {
  const merged = applyAccountOverlay(
    "google",
    {
      GOOGLE_ADS_CUSTOMER_ID: "house",
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: "mcc",
      GOOGLE_ADS_REFRESH_TOKEN: "house-refresh",
    },
    {
      GOOGLE_ADS_CUSTOMER_ID: "client",
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: "stolen-mcc",
      GOOGLE_ADS_REFRESH_TOKEN: "stolen",
    },
  );
  assert.equal(merged.GOOGLE_ADS_CUSTOMER_ID, "client");
  assert.equal(merged.GOOGLE_ADS_LOGIN_CUSTOMER_ID, "mcc");
  assert.equal(merged.GOOGLE_ADS_REFRESH_TOKEN, "house-refresh");
});

test("missing client IDs fail closed and do not fall back to house", () => {
  assert.throws(
    () =>
      select({
        platform: "meta",
        client: { ...client, metaAdAccountId: null },
      }),
    (err: unknown) => {
      assert.ok(err instanceof AccountIsolationError);
      assert.equal(err.code, "client_ids_missing");
      assert.match(err.message, /House accounts cannot be used/);
      return true;
    },
  );
});

test("client ID equal to house ID is rejected", () => {
  assert.throws(
    () =>
      select({
        platform: "meta",
        client: { ...client, metaAdAccountId: "1111111111" },
      }),
    (err: unknown) => {
      assert.ok(err instanceof AccountIsolationError);
      assert.equal(err.code, "house_id_collision");
      return true;
    },
  );
});

test("client Google Customer ID must not be the MCC", () => {
  assert.throws(
    () =>
      select({
        platform: "google",
        client: { ...client, googleCustomerId: "444-444-4444" },
      }),
    (err: unknown) => {
      assert.ok(err instanceof AccountIsolationError);
      assert.equal(err.code, "house_id_collision");
      return true;
    },
  );
});

test("house-test campaigns use empty overlay (house env/admin store)", () => {
  const t = select({ platform: "meta", isHouseTest: true });
  assert.equal(t.scope, "house");
  assert.deepEqual(t.overlay, {});
  assert.equal(t.publicTarget.metaAdAccountId, "1111111111");
});

test("house user campaigns use house accounts", () => {
  const t = select({
    platform: "tiktok",
    client: { ...client, isHouse: true },
  });
  assert.equal(t.scope, "house");
  assert.deepEqual(t.overlay, {});
});

test("unclaimed local tests may use house; paid clients may not", () => {
  assert.equal(
    resolvePublishScope({
      isHouseTest: false,
      userId: null,
      allowUnclaimedHouse: true,
      clientIsHouse: false,
    }),
    "house",
  );
  assert.equal(
    resolvePublishScope({
      isHouseTest: false,
      userId: "usr_1",
      allowUnclaimedHouse: true,
      clientIsHouse: false,
    }),
    "client",
  );
});

test("live Meta publish requires On Behalf Of consent; mock does not", () => {
  const pending = { ...client, metaBoboStatus: "requested" as const };
  const mockOk = select({ platform: "meta", client: pending, adsMode: "mock" });
  assert.equal(mockOk.scope, "client");
  assert.throws(
    () => select({ platform: "meta", client: pending, adsMode: "live" }),
    (err: unknown) => {
      assert.ok(err instanceof AccountIsolationError);
      assert.equal(err.code, "bobo_consent_required");
      assert.match(err.message, /On Behalf Of request/);
      return true;
    },
  );
});

test("live TikTok publish requires partner access accept", () => {
  assert.throws(
    () =>
      select({
        platform: "tiktok",
        adsMode: "live",
        client: { ...client, tiktokPartnerStatus: "requested" },
      }),
    (err: unknown) => {
      assert.ok(err instanceof AccountIsolationError);
      assert.equal(err.code, "tiktok_partner_required");
      return true;
    },
  );
});

test("campaign override wins over the stored client row", () => {
  const t = select({
    platform: "google",
    campaignOverride: { googleCustomerId: "8888888888" },
  });
  assert.equal(t.overlay.GOOGLE_ADS_CUSTOMER_ID, "8888888888");
});

test("published snapshot is preferred for later pause/metrics", () => {
  const t = select({
    platform: "meta",
    client: { ...client, metaAdAccountId: "9999999999" },
    publishedSnapshot: {
      scope: "client",
      metaAdAccountId: "5555555555",
      metaPageId: "page_client",
    },
  });
  assert.equal(t.overlay.META_BUSINESS_ID, "5555555555");
});

test("mergeClientIds prefers campaign override when set", () => {
  const merged = mergeClientIds(
    { metaAdAccountId: "111", metaPageId: "p1" },
    { metaAdAccountId: "222" },
  );
  assert.equal(merged.metaAdAccountId, "222");
  assert.equal(merged.metaPageId, "p1");
});

test("houseIdsFromCredentials reads META_BUSINESS_ID as Ad Account ID and Google MCC separately", () => {
  const ids = houseIdsFromCredentials({
    meta: { META_BUSINESS_ID: "act_1234567890" },
    tiktok: { TIKTOK_ADVERTISER_ID: "99" },
    google: {
      GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: "999-999-9999",
    },
  });
  assert.equal(ids.metaAdAccountId, "1234567890");
  assert.equal(ids.googleCustomerId, "1234567890");
  assert.equal(ids.googleLoginCustomerId, "9999999999");
});

test("human onboarding steps are named actions, not tokens", () => {
  const blob = [
    ...HUMAN_ONBOARDING_STEPS.meta,
    ...HUMAN_ONBOARDING_STEPS.tiktok,
    ...HUMAN_ONBOARDING_STEPS.google,
  ]
    .map((s) => s.name)
    .join(" ");
  assert.match(blob, /On Behalf Of/);
  assert.match(blob, /partner access/);
  assert.match(blob, /manager invitation/);
  assert.match(blob, /CUSTOMIZED_USER/);
  assert.equal(/EAA|secret|token_/i.test(blob), false);
});

test("ADS_MODE default remains mock and account targeting never assigns it", () => {
  const prev = process.env.ADS_MODE;
  delete process.env.ADS_MODE;
  assert.equal(adsMode(), "mock");
  process.env.ADS_MODE = prev;

  const files = ["accountTarget.ts", "clientAccounts.ts", "index.ts"];
  for (const rel of files) {
    const src = readFileSync(join(here, rel), "utf8");
    assert.equal(
      /process\.env\.ADS_MODE\s*=/.test(src),
      false,
      `${rel} must not assign ADS_MODE`,
    );
  }
});
