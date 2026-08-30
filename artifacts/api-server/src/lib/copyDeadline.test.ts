import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COPY_DEADLINE_MS, withDeadline } from "./copyDeadline.js";

const here = dirname(fileURLToPath(import.meta.url));

test("copy deadline is well under 20s and longer than the 12s miss", () => {
  assert.ok(COPY_DEADLINE_MS >= 16_000 && COPY_DEADLINE_MS < 20_000);
});

test("withDeadline returns the work when it finishes first", async () => {
  const value = await withDeadline(Promise.resolve("ready"), 200, () => new Error("late"));
  assert.equal(value, "ready");
});

test("withDeadline rejects while a hang is still pending — never waits it out", async () => {
  let hangSettled = false;
  const hang = new Promise<string>((resolve) => {
    setTimeout(() => {
      hangSettled = true;
      resolve("too late");
    }, 5_000);
  });
  const started = Date.now();
  await assert.rejects(
    () => withDeadline(hang, 40, () => new Error("Grok copy timed out")),
    /Grok copy timed out/,
  );
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 1_000, `deadline took ${elapsed}ms`);
  assert.equal(hangSettled, false);
});

test("generate returns campaign JSON; Grok miss fail-closes instead of copy_timeout", () => {
  const routes = readFileSync(join(here, "../routes/campaigns.ts"), "utf8");
  const gen = routes.slice(
    routes.indexOf('router.post("/generate"'),
    routes.indexOf('router.get("/")'),
  );
  assert.doesNotMatch(gen, /copy_timeout/);
  assert.match(gen, /Content-Type/);
  assert.match(gen, /res\.status\(201\)\.json\(campaign\)/);

  const write = readFileSync(join(here, "campaignService.ts"), "utf8");
  const writeFn = write.slice(
    write.indexOf("export async function writeCampaignCopy"),
    write.indexOf("export async function generateCampaignAsync"),
  );
  assert.match(writeFn, /withDeadline/);
  assert.match(writeFn, /COPY_DEADLINE_MS/);
  assert.match(writeFn, /failClosedCampaignFromBrief/);
  assert.doesNotMatch(writeFn, /copy_timeout/);
  assert.match(writeFn, /status: "ready"/);

  const grok = readFileSync(join(here, "../../../../lib/integrations-xai/src/client.ts"), "utf8");
  assert.match(grok, /GROK_CHAT_TIMEOUT_MS/);
  assert.match(grok, /AbortController/);
  assert.match(grok, /maxRetries:\s*0/);
  assert.match(grok, /signal:\s*controller\.signal/);
  assert.match(grok, /timeout:\s*GROK_CHAT_TIMEOUT_MS/);
  assert.ok(
    /export const GROK_CHAT_TIMEOUT_MS = (\d[\d_]*)/.test(grok),
  );
  const grokMs = Number(
    grok.match(/export const GROK_CHAT_TIMEOUT_MS = ([\d_]+)/)?.[1]?.replace(/_/g, ""),
  );
  assert.ok(grokMs > 0 && grokMs < 20_000);
});
