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
  assert.match(bundle, /assertVendoredSharpCallable/);
  assert.match(bundle, /sharp\(\) is a function/);
  assert.match(bundle, /import\.meta\.url/);
  assert.match(bundle, /import_meta_url/);
  assert.match(bundle, /staging/);
  assert.match(bundle, /ENOENT/);
  assert.match(bundle, /sharp-fn\.cjs/);
  assert.match(bundle, /__launchpadSharp/);
  assert.match(bundle, /typeof fromShim !== "function"/);
  assert.match(bundle, /typeof fromDirect !== "function"/);
  assert.match(bundle, /import\("sharp"\)/);
  assert.equal(vercel.services.api.functions["server.cjs"].includeFiles, "{node_modules/sharp/**,sharp-fn.cjs}");
});

test("createCampaign awaits Grok copy and does not start stills", () => {
  const src = readFileSync(join(here, "lib/campaignService.ts"), "utf8");
  const createStart = src.indexOf("export async function createCampaign");
  const createEnd = src.indexOf("export function drainStillsInBackground");
  const createFn = src.slice(createStart, createEnd);
  assert.match(createFn, /await writeCampaignCopy/);
  assert.doesNotMatch(createFn, /await processPendingJobs/);
  assert.doesNotMatch(createFn, /runInBackground/);
  assert.match(createFn, /stillsJobIds/);
  assert.match(src, /drainStillsInBackground/);
  assert.match(src, /renderCampaignStills/);
  assert.match(src, /campaignId: id/);
  const renderStart = src.indexOf("export async function renderCampaignStills");
  const renderFn = src.slice(renderStart, renderStart + 2800);
  assert.match(renderFn, /JOB_STATUS.pending/);
  assert.match(renderFn, /generate_image/);
  assert.match(renderFn, /lastErrors/);
  assert.doesNotMatch(renderFn, /writeCampaignCopy/);
  assert.match(src, /lastError: errorByIdx/);
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

test("POST /generate flushes JSON before any stills drain", () => {
  const routes = readFileSync(join(here, "routes/campaigns.ts"), "utf8");
  const genStart = routes.indexOf('router.post("/generate"');
  const genEnd = routes.indexOf("router.get(\"/\"");
  const gen = routes.slice(genStart, genEnd);
  assert.match(gen, /Content-Type/);
  assert.match(gen, /application\/json/);
  assert.match(gen, /withDeadline/);
  assert.match(gen, /COPY_DEADLINE_MS/);
  assert.match(gen, /res\.status\(201\)\.json\(campaign\)/);
  const jsonAt = gen.indexOf("res.status(201).json(campaign)");
  const drainAt = gen.indexOf("drainStillsInBackground");
  assert.ok(jsonAt >= 0 && drainAt > jsonAt, "stills drain must run after res.json");
  assert.doesNotMatch(gen, /await processPendingJobs/);
  assert.doesNotMatch(gen, /await svc\.drainStillsInBackground/);
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
