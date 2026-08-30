import { test } from "node:test";
import assert from "node:assert/strict";
import { failClosedCampaignFromBrief, brandNameFromBrief } from "./failClosedCampaign.js";
import { wordCount } from "./craft.js";

test("fail-closed campaign is briefing-presentable: three ads + landing from the brief", () => {
  const brief =
    "A ceramic pour-over kettle for apartment coffee. We roast in Brooklyn.";
  const data = failClosedCampaignFromBrief(brief);
  assert.match(brandNameFromBrief(brief), /Ceramic Pour-over Kettle/i);
  assert.match(data.brandName, /Ceramic/i);
  assert.match(data.brandName, /Kettle/i);
  assert.match(data.tagline, /ceramic pour-over/i);
  assert.equal(data.ads.length, 3);
  assert.ok(data.landing.hero);
  assert.ok(data.landing.sub.includes("ceramic") || data.landing.sub.includes("pour-over"));
  assert.equal(data.landing.faqs?.length, 3);
  assert.equal(
    data.channelSplit.metaPct + data.channelSplit.tiktokPct + data.channelSplit.googlePct,
    100,
  );
  for (const ad of data.ads) {
    const n = wordCount(ad.hook);
    assert.ok(n >= 2 && n <= 6, `hook "${ad.hook}" is ${n} words`);
    assert.ok(ad.body.length > 0);
    assert.ok(ad.imagePrompt.length > 20);
    assert.doesNotMatch(ad.imagePrompt, /\b(reading|says|lettering|typography|logos?)\b/i);
  }
  assert.match(data.ads[0]!.imagePrompt, /Hero pack-shot/i);
  assert.match(data.ads[1]!.imagePrompt, /Context shot/i);
  assert.match(data.ads[2]!.imagePrompt, /Tight crop/i);
});

test("fail-closed copy is derived from a short brief, not empty lorem", () => {
  const data = failClosedCampaignFromBrief("mushroom coffee");
  assert.match(data.brandName, /Mushroom/i);
  assert.equal(data.ads.length, 3);
  assert.match(JSON.stringify(data.ads), /mushroom/i);
});
