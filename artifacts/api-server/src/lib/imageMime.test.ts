import { test } from "node:test";
import assert from "node:assert/strict";
import { detectImageMime, reencodeToPng, EDIT_MIME } from "./imageMime.js";

test("detects JPEG magic bytes", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(detectImageMime(jpeg), "image/jpeg");
});

test("detects PNG magic bytes", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x0a, 0x1a]);
  assert.equal(detectImageMime(png), "image/png");
});

test("JPEG uploads re-encode to PNG so edit MIME matches bytes", async () => {
  const { default: sharp } = await import("sharp");
  const jpeg = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 12, g: 34, b: 56 } },
  })
    .jpeg()
    .toBuffer();
  assert.equal(detectImageMime(jpeg), "image/jpeg");
  const png = await reencodeToPng(jpeg);
  assert.equal(detectImageMime(png), "image/png");
  assert.equal(EDIT_MIME, "image/png");
});
