"use strict";

const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "../../..");

function importDist(...parts) {
  return import(pathToFileURL(path.join(REPO_ROOT, "artifacts", "tools", "dist", ...parts)).href);
}

test("scenario contract predicates reject structurally incomplete input and evidence", async () => {
  const modules = await Promise.all([
    importDist("capabilities", "workspace-governance", "discover-language-bindings", "model.js"),
    importDist("capabilities", "workspace-governance", "determine-active-language-obligations", "model.js"),
    importDist("capabilities", "workspace-governance", "verify-governed-placement", "model.js"),
    importDist("capabilities", "workspace-governance", "admit-language-declaration", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "determine-authority-conformance", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "admit-kernel-specification", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "admit-schema-family", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "admit-execution-vector", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "determine-shape-conformance", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "determine-execution-conformance", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "determine-behavioral-conformance", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "determine-execution-closure", "model.js"),
    importDist("capabilities", "kernel-implementation-admission", "decide-implementation-admission", "model.js"),
    importDist("capabilities", "conformance-evidence-publication", "observe-language-behavior", "model.js"),
    importDist("capabilities", "conformance-evidence-publication", "publish-implementation-evidence", "model.js"),
    importDist("capabilities", "conformance-evidence-publication", "derive-cross-language-equivalence", "model.js")
  ]);
  const predicates = modules.flatMap((module) => Object.entries(module)
    .filter(([name, value]) => name.startsWith("is") && typeof value === "function")
    .map(([, value]) => value));
  assert.ok(predicates.length >= 30);
  for (const predicate of predicates) {
    assert.equal(predicate({}), false);
    assert.equal(predicate(null), false);
  }
});
