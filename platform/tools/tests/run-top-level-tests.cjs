"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const tests = fs.readdirSync(__dirname, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".test.js"))
  .map((entry) => path.join(__dirname, entry.name))
  .sort();

if (tests.length === 0) throw new Error("No top-level tooling tests were discovered.");

const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: path.resolve(__dirname, "../.."),
  stdio: "inherit"
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
