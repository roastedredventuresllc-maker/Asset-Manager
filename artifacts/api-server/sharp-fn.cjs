"use strict";

/**
 * Unbundled CJS seam for the Vercel Express lambda.
 * `await import("sharp")` / esbuild `__toESM` yields a namespace object —
 * production: `unwrapSharpExport` threw "sharp is not a function (got object)"
 * after Imagine had already made plates. This file only `require`s the
 * CommonJS constructor and exports that function.
 */
const loaded = require("sharp");
const fn = typeof loaded === "function" ? loaded : loaded && loaded.default;
if (typeof fn !== "function") {
  throw new Error(
    `sharp-fn.cjs: require("sharp") is not a function (got ${typeof fn})`,
  );
}
module.exports = fn;
