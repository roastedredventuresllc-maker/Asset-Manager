import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const home = readFileSync(resolve(here, "../../../launchpad/src/pages/home.tsx"), "utf8");
const board = readFileSync(
  resolve(here, "../../../launchpad/src/components/campaign-board.tsx"),
  "utf8",
);

test("briefing is an art director table, not a variant gallery", () => {
  assert.doesNotMatch(home, /Variant\s*[ABC]/i);
  assert.doesNotMatch(home, /Ad\s*[123]\s*[—-]/);
  assert.doesNotMatch(home, /\blorem\b/i);
  assert.match(board, /Hero/);
  assert.match(board, /In use/);
  assert.match(board, /Close/);
  assert.doesNotMatch(board, /linear-gradient/);
  assert.match(home, /What's off|What’s off/);
  assert.doesNotMatch(home, /InSituAd/);
  assert.match(home, /AGENCY_STEPS/);
  assert.match(home, /Research/);
  assert.match(home, /\bBrief\b/);
  assert.match(home, /\bCopy\b/);
  assert.match(home, /Creative/);
  assert.match(home, /\bMedia\b/);
  assert.match(home, /briefing/);
  // Dark /p/ landing preview is the briefing iframe. Platform chrome is locked out.
  assert.match(home, /src=\{`\/p\/\$\{campaign\.landingSlug\}`\}/);
  assert.doesNotMatch(home, /facebook\.com|tiktok\.com|adsmanager|InSituAd/i);
  assert.doesNotMatch(home, /The live page/);
  assert.match(home, /The page/);
  assert.doesNotMatch(home, /Writing…|Writing the campaign/);
  assert.match(home, /GENERATE_TIMEOUT_MS/);
  const timeoutLiteral = home.match(/GENERATE_TIMEOUT_MS\s*=\s*([\d_]+)/);
  assert.ok(timeoutLiteral, "GENERATE_TIMEOUT_MS must be a numeric literal");
  const timeoutMs = Number(timeoutLiteral[1].replaceAll("_", ""));
  assert.ok(
    timeoutMs >= 240_000,
    `client generate timeout ${timeoutMs}ms must not fire before a normal 100–160s copy-first 201`,
  );
});

test("failed photography is not shipped as a gradient ad", () => {
  assert.match(board, /Generation failed/);
  assert.match(home, /assetsFailed/);
  assert.match(home, /Generation failed/);
});

test("landing route does not ship a lettermark kit when stills miss", () => {
  const landingRoute = readFileSync(
    resolve(here, "../routes/landing.ts"),
    "utf8",
  );
  const landingPage = readFileSync(resolve(here, "landingPage.ts"), "utf8");
  assert.match(landingRoute, /pickLandingPhoto/);
  assert.match(landingPage, /failClosedHtml|photography did not come back/i);
  assert.match(landingPage, /This is not a product page until the stills exist/);
  assert.doesNotMatch(landingPage, /hv-mark/);
  assert.doesNotMatch(landingPage, /★★★★★/);
  assert.doesNotMatch(landingPage, /function initials/);
  assert.doesNotMatch(landingPage, /F9F7F4/);
  assert.doesNotMatch(landingPage, /See how it works/);
  assert.doesNotMatch(landingPage, /class="halo"/);
});
