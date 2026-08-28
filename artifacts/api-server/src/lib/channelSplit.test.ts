import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveGoogleSharePct } from "./channelSplit.js";

test("explicit Google share is kept, including 0", () => {
  assert.equal(resolveGoogleSharePct(40, 30, 30), 30);
  assert.equal(resolveGoogleSharePct(50, 50, 0), 0);
});

test("omitted Google share is the remainder so Meta+TikTok+Google sum to 100", () => {
  assert.equal(resolveGoogleSharePct(40, 30), 30);
  assert.equal(resolveGoogleSharePct(70, 30), 0);
  assert.equal(resolveGoogleSharePct(40, 30, undefined), 30);
  assert.equal(resolveGoogleSharePct(40, 30, null), 30);
});
