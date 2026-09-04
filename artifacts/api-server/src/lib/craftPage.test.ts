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
const app = readFileSync(resolve(here, "../../../launchpad/src/App.tsx"), "utf8");
const familyPreview = readFileSync(
  resolve(here, "../../../launchpad/src/pages/family-preview.tsx"),
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
  assert.doesNotMatch(home, /<iframe/);
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

function recordStringValues(src: string, name: string): string[] {
  const block = src.match(new RegExp(`export const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  assert.ok(block, `${name} must be an exported record of string slots`);
  return [...block[1].matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]!);
}

test("three ready prints are one family, not an identical card gallery", () => {
  assert.match(home, /CampaignFamily/);
  assert.match(board, /data-campaign-family/);
  assert.match(board, /data-family-table/);
  assert.match(board, /data-family-slot/);
  assert.match(board, /FAMILY_CROP_CLASS\[beat\]/);

  const tableClass = board.match(/export const FAMILY_TABLE_CLASS\s*=\s*"([^"]+)"/);
  assert.ok(tableClass, "FAMILY_TABLE_CLASS must be a string literal");
  assert.doesNotMatch(tableClass[1], /grid-cols-3/);
  assert.match(tableClass[1], /md:grid-cols-\[/);
  assert.match(tableClass[1], /1\.28fr/);
  assert.match(tableClass[1], /0\.46fr/);
  assert.match(tableClass[1], /0\.7fr/);

  const slots = recordStringValues(board, "FAMILY_SLOT_CLASS");
  assert.equal(slots.length, 3, "exactly three table slots");
  assert.equal(new Set(slots).size, 3, "slot classes must differ — matching wrappers are a card gallery");
  assert.match(slots[0]!, /row-span-2/);
  assert.match(slots[1]!, /col-start-2/);
  assert.match(slots[2]!, /row-start-2/);
  assert.match(slots[2]!, /mt-16/);

  const crops = recordStringValues(board, "FAMILY_CROP_CLASS");
  assert.equal(crops.length, 3, "exactly three crops");
  assert.equal(new Set(crops).size, 3, "ready stills must crop differently per beat");
  assert.match(crops[0]!, /object-bottom/);
  assert.doesNotMatch(crops[0]!, /scale-/);
  assert.match(crops[1]!, /object-center/);
  assert.doesNotMatch(crops[1]!, /scale-/);
  assert.match(crops[2]!, /scale-\[1\.24\]/);

  const aspects = recordStringValues(board, "FAMILY_ASPECT_CLASS");
  assert.equal(aspects[0], "aspect-[4/5]");
  assert.equal(aspects[1], "aspect-[9/16]");
  assert.equal(aspects[2], "aspect-[4/5]");

  const bands = recordStringValues(board, "FAMILY_TYPE_BAND");
  assert.equal(bands[0], "h-[32%]");
  assert.equal(bands[1], "h-[28%]");
  assert.equal(bands[2], "h-[32%]");

  const typeSizes = recordStringValues(board, "FAMILY_TYPE_SIZE");
  assert.equal(new Set(typeSizes).size, 3, "pending type in the crop must change size per beat");

  assert.match(board, /idx === 1\) return "context"/);
  assert.match(board, /idx === 2\) return "close"/);
  assert.match(board, /Hero/);
  assert.match(board, /In use/);
  assert.match(board, /Close/);
  assert.doesNotMatch(board, /Variant\s*[ABC]/i);
  assert.doesNotMatch(board, /grid-cols-3/);
  assert.doesNotMatch(board, /linear-gradient/);

  assert.match(board, /beat === "hero" && hook && !failed/);
  assert.match(board, /data-family-caption/);

  const briefing = home.slice(
    home.indexOf("Art director's table"),
    home.indexOf("{landing ?"),
  );
  assert.ok(briefing.length > 40, "briefing table region must stay in home.tsx");
  assert.match(briefing, /CampaignFamily/);
  assert.doesNotMatch(briefing, /grid-cols-3/);
  assert.doesNotMatch(briefing, /flex-row/);
  assert.doesNotMatch(briefing, /InSituAd/);
  assert.doesNotMatch(briefing, /<iframe/);

  assert.match(app, /import\.meta\.env\.DEV \? <Route path="\/__family"/);
  assert.match(familyPreview, /CampaignFamily/);
  assert.doesNotMatch(familyPreview, /Variant\s*[ABC]/i);
  const previewStills = familyPreview.match(/imageUrl:\s*STILL/g) ?? [];
  assert.equal(
    previewStills.length,
    3,
    "DEV table must reuse one still across three beats — three photos would hide a crop regression",
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
