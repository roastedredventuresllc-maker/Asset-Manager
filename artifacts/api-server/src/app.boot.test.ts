import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import healthRouter from "./routes/health.js";

const here = dirname(fileURLToPath(import.meta.url));

test("db Pool construction catches missing DATABASE_URL on Vercel", () => {
  const src = readFileSync(join(here, "../../../lib/db/src/index.ts"), "utf8");
  assert.match(src, /poolConnectionString/);
  assert.match(src, /launchpad_unconfigured/);
});

test("app.ts does not statically import the DB or campaign routes", () => {
  const src = readFileSync(join(here, "app.ts"), "utf8");
  assert.equal(/from ["']@workspace\/db["']/.test(src), false);
  assert.equal(/from ["']\.\/routes\/index/.test(src), false);
  assert.match(src, /healthRouter/);
});

test("health.ts does not import workspace packages", () => {
  const src = readFileSync(join(here, "routes/health.ts"), "utf8");
  assert.equal(/@workspace\//.test(src), false);
});

test("Vercel api service bundles Express into server.cjs", () => {
  const vercel = JSON.parse(
    readFileSync(join(here, "../../../vercel.json"), "utf8"),
  );
  assert.equal(vercel.services.api.entrypoint, "server.cjs");
  assert.equal(vercel.services.api.buildCommand, "node ./scripts/bundle-vercel.mjs");
  assert.equal(vercel.env?.ADS_MODE, "mock");
  const bundle = readFileSync(
    join(here, "../scripts/bundle-vercel.mjs"),
    "utf8",
  );
  assert.match(bundle, /outfile: path.join\(serviceRoot, "server.cjs"\)/);
  assert.match(bundle, /packages: "bundle"/);
  assert.match(bundle, /@vercel\/functions/);
  assert.match(bundle, /vendorSharp/);
  assert.match(bundle, /dereference: true/);
});

test("createCampaign awaits Grok copy, not the stills drain", () => {
  const src = readFileSync(join(here, "lib/campaignService.ts"), "utf8");
  const createStart = src.indexOf("export async function createCampaign");
  const createEnd = src.indexOf("export async function renderCampaignStills");
  const createFn = src.slice(createStart, createEnd);
  assert.match(createFn, /await writeCampaignCopy/);
  assert.doesNotMatch(createFn, /await processPendingJobs/);
  assert.match(createFn, /runInBackground/);
  assert.match(src, /renderCampaignStills/);
  assert.match(src, /campaignId: id/);
});

test("index.ts does not statically import the DB/worker graph", () => {
  const src = readFileSync(join(here, "index.ts"), "utf8");
  assert.equal(/from ["']\.\/lib\/worker/.test(src), false);
  assert.equal(/from ["']\.\/lib\/spendGuard/.test(src), false);
  assert.equal(/from ["']\.\/lib\/referenceAssets/.test(src), false);
});

test("worker does not retry generate_image (one Imagine + one gpt-image-2 already ran)", () => {
  const src = readFileSync(join(here, "lib/worker.ts"), "utf8");
  assert.match(src, /failNow/);
  assert.match(src, /generate_image/);
  assert.match(src, /jobIds/);
  assert.match(src, /campaignId/);
  assert.match(src, /reclaimStaleProcessingJobs/);
});

test("mock publish skips Stripe and allows unclaimed house in production", () => {
  const publish = readFileSync(join(here, "lib/publish.ts"), "utf8");
  assert.match(publish, /adsMode\(\) !== "live"/);
  const service = readFileSync(join(here, "lib/campaignService.ts"), "utf8");
  assert.match(service, /if \(mode !== "live"\)/);
  assert.match(service, /publishCampaignToPlatforms/);
  assert.match(service, /checkoutUrl: null/);
  const stripeIdx = service.indexOf("STRIPE_SECRET_KEY");
  const mockIdx = service.indexOf('if (mode !== "live")');
  assert.ok(mockIdx >= 0 && stripeIdx > mockIdx, "Stripe must run only after the mock branch");
  const routes = readFileSync(join(here, "routes/campaigns.ts"), "utf8");
  assert.match(routes, /adsMode\(\) === "live"/);
  assert.match(routes, /render-stills/);
  assert.equal(/process\.env\.ADS_MODE\s*=/.test(service), false);
  assert.equal(/process\.env\.ADS_MODE\s*=/.test(publish), false);
  assert.equal(/process\.env\.ADS_MODE\s*=/.test(routes), false);
});

test("GET /api/healthz returns {status:ok} without touching the DB", async () => {
  const app = express();
  app.use("/api", healthRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
