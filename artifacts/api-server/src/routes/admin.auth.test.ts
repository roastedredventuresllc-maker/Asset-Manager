import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const here = dirname(fileURLToPath(import.meta.url));
const adminTs = readFileSync(join(here, "admin.ts"), "utf8");
const adminUi = readFileSync(join(here, "../../../launchpad/src/pages/admin.tsx"), "utf8");
const appTsx = readFileSync(join(here, "../../../launchpad/src/App.tsx"), "utf8");
const homeTsx = readFileSync(join(here, "../../../launchpad/src/pages/home.tsx"), "utf8");
const replitMd = readFileSync(join(here, "../../../../replit.md"), "utf8");

test("GET /api/admin/status is unauthenticated and leaks only configured + adsMode", () => {
  assert.match(adminTs, /router\.get\("\/status"/);
  const statusStart = adminTs.indexOf('router.get("/status"');
  const statusEnd = adminTs.indexOf("router.post(\"/login\"");
  const statusFn = adminTs.slice(statusStart, statusEnd);
  assert.match(statusFn, /configured: Boolean\(adminSecret\(\)\)/);
  assert.match(statusFn, /adsMode: adsMode\(\)/);
  assert.equal(/requireAdmin/.test(statusFn), false);
  assert.match(statusFn, /res\.json\(\{ configured:/);
});

test("admin login and connector save never assign ADS_MODE", () => {
  assert.equal(/process\.env\.ADS_MODE\s*=/.test(adminTs), false);
  assert.match(adminTs, /Saving credentials must NEVER flip ADS_MODE/);
});

test("SPA routes /admin, /admin/connectors, and /login to Admin", () => {
  assert.match(appTsx, /path="\/admin\/connectors"/);
  assert.match(appTsx, /path="\/admin\/clients"/);
  assert.match(appTsx, /path="\/login"/);
  assert.match(appTsx, /path="\/admin"/);
});

test("admin desk is not gated on the reference library", () => {
  assert.match(adminUi, /Validate the token against connectors/);
  assert.match(adminUi, /fetch\("\/api\/admin\/connectors"/);
  assert.match(adminUi, /Enter the operator password/);
  assert.match(adminUi, /deskFromPath/);
  assert.match(adminUi, /\/admin\/connectors/);
  assert.equal(/if \(!library\) return/.test(adminUi), false);
});

test("briefing embeds the dark /p/ landing, not platform chrome", () => {
  assert.match(homeTsx, /<iframe/);
  assert.match(homeTsx, /src=\{`\/p\/\$\{campaign\.landingSlug\}`\}/);
  assert.equal(/facebook\.com|tiktok\.com|ads manager/i.test(homeTsx), false);
});

test("replit.md image path matches code (Imagine then gpt-image-2)", () => {
  assert.match(replitMd, /Grok Imagine/);
  assert.match(replitMd, /gpt-image-2/);
  assert.equal(/gemini-3-pro-image-preview then `gpt-image-1`/.test(replitMd), false);
});

async function withAdminServer(
  env: { ADMIN_PASSWORD?: string; ADS_MODE?: string },
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const prevPw = process.env.ADMIN_PASSWORD;
  const prevMode = process.env.ADS_MODE;
  if (env.ADMIN_PASSWORD === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  process.env.ADS_MODE = env.ADS_MODE ?? "mock";

  const { default: adminRouter } = await import("./admin.js");
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    if (prevPw === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevPw;
    if (prevMode === undefined) delete process.env.ADS_MODE;
    else process.env.ADS_MODE = prevMode;
  }
}

test("GET /status and POST /login without ADMIN_PASSWORD", async () => {
  await withAdminServer({ ADMIN_PASSWORD: undefined, ADS_MODE: "mock" }, async (base) => {
    const status = await fetch(`${base}/api/admin/status`);
    assert.equal(status.status, 200);
    const body = (await status.json()) as { configured: boolean; adsMode: string };
    assert.equal(body.configured, false);
    assert.equal(body.adsMode, "mock");
    assert.equal("password" in body, false);

    const login = await fetch(`${base}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "x" }),
    });
    assert.equal(login.status, 503);
    const err = (await login.json()) as { error: string };
    assert.match(err.error, /not configured/i);
  });
});

test("password login then connectors status; save does not flip ADS_MODE", async () => {
  const password = "operator-test-password";
  await withAdminServer({ ADMIN_PASSWORD: password, ADS_MODE: "mock" }, async (base) => {
    const status = await fetch(`${base}/api/admin/status`);
    const statusBody = (await status.json()) as { configured: boolean; adsMode: string };
    assert.equal(statusBody.configured, true);
    assert.equal(statusBody.adsMode, "mock");

    const bad = await fetch(`${base}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    assert.equal(bad.status, 401);

    const login = await fetch(`${base}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    assert.equal(login.status, 200);
    const { token } = (await login.json()) as { token: string };
    assert.ok(token.includes("."));

    const connectors = await fetch(`${base}/api/admin/connectors`, {
      headers: { "x-admin-token": token },
    });
    assert.equal(connectors.status, 200);
    const data = (await connectors.json()) as {
      adsMode: string;
      connectors: { id: string; connected: boolean; requiredSecretKeys: string[] }[];
    };
    assert.equal(data.adsMode, "mock");
    assert.deepEqual(
      data.connectors.map((c) => c.id).sort(),
      ["google", "meta", "tiktok"],
    );
    for (const c of data.connectors) {
      assert.ok(c.requiredSecretKeys.length > 0);
      assert.equal("values" in c, false);
    }

    const save = await fetch(`${base}/api/admin/connectors/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ values: { META_DEFAULT_PAGE_ID: "12345" } }),
    });
    assert.ok(save.status === 200 || save.status === 500);
    if (save.status === 200) {
      const saved = (await save.json()) as { adsMode: string };
      assert.equal(saved.adsMode, "mock");
    }
    assert.equal(process.env.ADS_MODE, "mock");
  });
});
