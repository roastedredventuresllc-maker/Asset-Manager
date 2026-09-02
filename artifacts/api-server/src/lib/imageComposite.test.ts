import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compositeAdImage } from "./imageComposite.js";
import { loadSharp } from "./loadSharp.js";
import { assertCompositedTypeIsReadable, typeInkStats } from "./typeInk.js";
import {
  COMPOSITE_FONT_FAMILY,
  resolveCompositeFontFile,
} from "./loadCompositeFonts.js";

const here = dirname(fileURLToPath(import.meta.url));

async function darkPlate(width: number, height: number): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp({
    create: { width, height, channels: 3, background: "#161310" },
  })
    .png()
    .toBuffer();
}

test("vendored Inter Regular + Bold TTFs exist for the lambda", () => {
  const regular = resolveCompositeFontFile("Inter-Regular.ttf");
  const bold = resolveCompositeFontFile("Inter-Bold.ttf");
  assert.match(regular, /Inter-Regular\.ttf$/);
  assert.match(bold, /Inter-Bold\.ttf$/);
  assert.equal(readFileSync(regular).subarray(0, 4).equals(Buffer.from([0, 1, 0, 0])), true);
  assert.equal(readFileSync(bold).subarray(0, 4).equals(Buffer.from([0, 1, 0, 0])), true);
});

test("fonts-fn.cjs resolves Inter next to server.cjs — the lambda path", () => {
  const serviceRoot = join(here, "../..");
  const req = createRequire(join(serviceRoot, "fonts-fn.cjs"));
  const fonts = req("./fonts-fn.cjs") as {
    resolve: (name: string) => string;
    dir: string;
  };
  const regular = fonts.resolve("Inter-Regular.ttf");
  assert.equal(regular, join(serviceRoot, "fonts", "Inter-Regular.ttf"));
  assert.equal(fonts.dir, join(serviceRoot, "fonts"));
});

test("composite SVG names only LaunchPadInter — no Times or system fonts", () => {
  const src = readFileSync(join(here, "imageComposite.ts"), "utf8");
  assert.match(src, /COMPOSITE_FONT_FAMILY/);
  assert.match(src, /compositeFontFaceCss/);
  assert.doesNotMatch(src, /Times New Roman/);
  assert.doesNotMatch(src, /font-family="Times/);
  assert.doesNotMatch(src, /Georgia/);
  assert.doesNotMatch(src, /Arial/);
  assert.doesNotMatch(src, /sans-serif/);
  assert.doesNotMatch(src, /fonts\.google/);
  assert.doesNotMatch(src, /googleapis/);
});

test("compositeAdImage paints readable Inter brand + hook + CTA, not tofu", async () => {
  const photo = await darkPlate(400, 500);
  const png = await compositeAdImage({
    ad: {
      hook: "Wake up clearer",
      body: "A nightly ritual.",
      cta: "Get yours",
      angle: "Hero",
      imagePrompt: "soft window light",
      gradientHex1: "#111",
      gradientHex2: "#222",
    },
    brandName: "Nox",
    sourceImageBuffer: photo,
    width: 400,
    height: 500,
  });
  const stats = await assertCompositedTypeIsReadable(png, "Wake up clearer");
  assert.ok(stats.ink > 800, `expected letter ink, got ${stats.ink}`);
  assert.equal(stats.hollowBoxes, 0);
  assert.equal(COMPOSITE_FONT_FAMILY, "LaunchPadInter");
});

test("a missing font-family burns hollow tofu — that is the fail we reject", async () => {
  const sharp = await loadSharp();
  const photo = await darkPlate(400, 500);
  const tofuSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500">
  <rect width="400" height="160" fill="#000"/>
  <text x="200" y="70" text-anchor="middle" font-family="DefinitelyMissingLaunchPadFont" font-size="42" fill="white">HELLO</text>
  <text x="200" y="120" text-anchor="middle" font-family="DefinitelyMissingLaunchPadFont" font-size="16" fill="white">Get yours</text>
</svg>`);
  const burned = await sharp(photo)
    .composite([{ input: tofuSvg, top: 0, left: 0 }])
    .png()
    .toBuffer();
  const burnedStats = await typeInkStats(burned);
  const good = await compositeAdImage({
    ad: {
      hook: "Hello there friend",
      body: "A nightly ritual.",
      cta: "Get yours",
      angle: "Hero",
      imagePrompt: "soft window light",
      gradientHex1: "#111",
      gradientHex2: "#222",
    },
    brandName: "Nox",
    sourceImageBuffer: photo,
    width: 400,
    height: 500,
  });
  const goodStats = await assertCompositedTypeIsReadable(good, "Hello there friend");
  assert.ok(
    goodStats.ink > burnedStats.ink,
    `Inter ink ${goodStats.ink} should beat missing-font ink ${burnedStats.ink}`,
  );
});
