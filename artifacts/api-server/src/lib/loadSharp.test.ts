import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadSharp, unwrapSharp } from "./loadSharp.js";
import { rejectIfFlatGradient, assertCraftPlate, CraftReject } from "./craft.js";

const here = dirname(fileURLToPath(import.meta.url));

test("unwrapSharp accepts a bare CJS factory", () => {
  const fn = () => "ok";
  assert.equal(unwrapSharp(fn), fn);
});

test("unwrapSharp accepts { default: factory } (CJS-in-CJS bundle)", () => {
  const fn = () => "ok";
  assert.equal(unwrapSharp({ default: fn }), fn);
});

test("unwrapSharp accepts { default: { default: factory } }", () => {
  const fn = () => "ok";
  assert.equal(unwrapSharp({ default: { default: fn } }), fn);
});

test("unwrapSharp throws when nothing is callable", () => {
  assert.throws(() => unwrapSharp({ default: { stats: true } }), /sharp is not a function/);
});

test("loadSharp() returns a callable factory", async () => {
  const sharp = await loadSharp();
  assert.equal(typeof sharp, "function");
  const buf = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 80, b: 40 } },
  })
    .png()
    .toBuffer();
  assert.ok(buf.length > 8);
});

test("Craft lock runs through loadSharp — noisy photo passes, flat field fails", async () => {
  const sharp = await loadSharp();
  const raw = Buffer.alloc(64 * 80 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 37 + (i % 17) * 13) & 255;
  const photo = await sharp(raw, { raw: { width: 64, height: 80, channels: 3 } })
    .jpeg()
    .toBuffer();
  await assertCraftPlate(photo);

  const flat = await sharp({
    create: { width: 64, height: 80, channels: 3, background: { r: 12, g: 12, b: 12 } },
  })
    .jpeg()
    .toBuffer();
  await assert.rejects(() => rejectIfFlatGradient(flat), (err: unknown) => err instanceof CraftReject);
});

test("unwrapSharp matches the CJS interop shape esbuild emits for external sharp", () => {
  const factory = () => "ok";
  const required = { default: factory };
  const toESM = (mod: { default?: unknown; __esModule?: boolean }) => {
    if (mod && mod.__esModule) return mod;
    return { default: mod };
  };
  const imported = toESM(required);
  assert.equal(typeof imported.default, "object");
  assert.throws(() => {
    const sharp = imported.default as unknown;
    if (typeof sharp !== "function") throw new TypeError("sharp is not a function");
  }, /sharp is not a function/);
  assert.equal(unwrapSharp(imported), factory);
});

test("craft and composite never destructure sharp.default", () => {
  const craft = readFileSync(join(here, "craft.ts"), "utf8");
  const composite = readFileSync(join(here, "imageComposite.ts"), "utf8");
  const mime = readFileSync(join(here, "imageMime.ts"), "utf8");
  for (const src of [craft, composite, mime]) {
    assert.equal(/const \{ default: sharp \}/.test(src), false);
    assert.match(src, /loadSharp/);
  }
});
