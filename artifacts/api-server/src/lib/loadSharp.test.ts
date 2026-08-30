import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  loadSharp,
  unwrapSharpExport,
  resetSharpCache,
} from "./loadSharp.js";
import { rejectIfFlatGradient, CraftReject } from "./craft.js";

const here = dirname(fileURLToPath(import.meta.url));

function fakeToEsm(mod: unknown): { default: unknown } {
  // esbuild __toESM when the namespace has no __esModule: default = the module.
  return { default: mod };
}

test("unwrapSharpExport recovers the function from CJS / double-default interop", async () => {
  const sharp = await loadSharp();
  assert.equal(typeof sharp, "function");
  assert.equal(unwrapSharpExport(sharp), sharp);
  assert.equal(unwrapSharpExport({ default: sharp }), sharp);
  assert.equal(unwrapSharpExport({ default: { default: sharp } }), sharp);
  const wrapped = fakeToEsm({ default: sharp });
  const broken = wrapped.default;
  assert.notEqual(typeof broken, "function");
  assert.equal(typeof unwrapSharpExport(wrapped), "function");
  assert.equal(typeof unwrapSharpExport(broken), "function");
});

test("unwrapSharpExport fails closed when there is no function", () => {
  assert.throws(() => unwrapSharpExport({ default: { foo: 1 } }), /sharp is not a function/);
});

test("rejectIfFlatGradient calls sharp() as a function (the production crash)", async () => {
  resetSharpCache();
  const sharp = await loadSharp();
  assert.equal(typeof sharp, "function");
  const flat = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#cc2200" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () => rejectIfFlatGradient(flat),
    (err: unknown) => err instanceof CraftReject,
  );

  const raw = Buffer.alloc(32 * 32 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 17) % 256;
  const noisy = await sharp(raw, { raw: { width: 32, height: 32, channels: 3 } })
    .png()
    .toBuffer();
  await rejectIfFlatGradient(noisy);
});

test("loadSharp requires the CJS constructor, never import(\"sharp\")", () => {
  const src = readFileSync(join(here, "loadSharp.ts"), "utf8");
  assert.doesNotMatch(src, /await import\(["']sharp["']\)/);
  assert.match(src, /sharp-fn\.cjs/);
  assert.match(src, /createRequire/);
  assert.match(src, /__launchpadSharp/);
  const shim = readFileSync(join(here, "../../sharp-fn.cjs"), "utf8");
  assert.match(shim, /require\(["']sharp["']\)/);
  assert.match(shim, /module\.exports = fn/);
});

test("sharp-fn.cjs require() is a function at runtime (the lambda contract)", async () => {
  const req = createRequire(join(here, "../../server.cjs"));
  const fn = req("./sharp-fn.cjs");
  assert.equal(typeof fn, "function");
  const buf = await fn({
    create: { width: 8, height: 8, channels: 3, background: "#112233" },
  })
    .png()
    .toBuffer();
  assert.equal(buf[0], 0x89);
});

test("Craft and the image pipeline load sharp through unwrap, not default destructure", () => {
  for (const rel of [
    "craft.ts",
    "imageComposite.ts",
    "imageMime.ts",
    "imagePipeline.ts",
  ]) {
    const src = readFileSync(join(here, rel), "utf8");
    assert.equal(
      /const \{ default: sharp \} = await import\(["']sharp["']\)/.test(src),
      false,
      `${rel} must not destructure import("sharp").default`,
    );
    if (rel !== "imagePipeline.ts") {
      assert.match(src, /loadSharp/);
    }
  }
});
