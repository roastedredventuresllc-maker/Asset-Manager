"use strict";

/**
 * Unbundled CJS seam for Inter Regular + Bold next to server.cjs.
 * NFT never traces a TTF. includeFiles must copy fonts/Inter-Regular.ttf
 * and fonts/Inter-Bold.ttf to /var/task/fonts/ (cwd/fonts on the lambda).
 * Preview ALbkWDpm: fonts lived in git but not at this path.
 */
const fs = require("fs");
const path = require("path");

const FONT_DIR = path.join(__dirname, "fonts");

function resolve(filename) {
  const full = path.join(FONT_DIR, filename);
  if (!fs.existsSync(full)) {
    throw new Error(
      `LaunchPad Inter font missing (${filename}). Composite would burn tofu boxes.`,
    );
  }
  return full;
}

module.exports = {
  dir: FONT_DIR,
  resolve,
};
