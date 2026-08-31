"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const REPO_ROOT = path.resolve(__dirname, "../..");

const CAPABILITY_ROOT = path.join(REPO_ROOT, "tools", "src", "capabilities");
const PROHIBITED = [
  /from\s+["']node:/,
  /from\s+["'][^"']*\/adapters\//,
  /require\s*\(\s*["']node:/,
  /\bprocess\./,
  /\bconsole\./
];

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(resolved) : entry.name.endsWith(".ts") ? [resolved] : [];
  });
}

test("capability and scenario modules do not import Node infrastructure", () => {
  const violations = [];
  for (const file of sourceFiles(CAPABILITY_ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of PROHIBITED) {
      if (pattern.test(source)) violations.push(`${path.relative(REPO_ROOT, file)} matches ${pattern}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("superseded tooling trees and legacy entrypoints cannot return", () => {
  assert.equal(fs.existsSync(path.join(REPO_ROOT, "tools", "conformance")), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, "tools", "projection")), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, "tools", "consumer-projection")), false);
  const roots = [path.join(REPO_ROOT, "package.json"), path.join(REPO_ROOT, "tools")];
  const legacyReference = /(?:tools\/(?:conformance|consumer-projection)\/|(?:\.\.\/)+conformance\/(?:asserts|computes|discovers|evaluates|generate|inspects|observes|runs|validates))/;
  const violations = [];
  const inspect = (candidate) => {
    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) {
      if (candidate.includes(`${path.sep}artifacts${path.sep}`)) return;
      for (const entry of fs.readdirSync(candidate)) inspect(path.join(candidate, entry));
      return;
    }
    if (!/\.(?:cjs|js|json|mjs|ts)$/.test(candidate)) return;
    if (legacyReference.test(fs.readFileSync(candidate, "utf8"))) {
      violations.push(path.relative(REPO_ROOT, candidate));
    }
  };
  for (const root of roots) inspect(root);
  assert.deepEqual(violations, []);
});

test("ADR-0014 bootstrap admission cannot be ratcheted or left overdue", () => {
  const policy = JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, "governance", "admitted-bootstrap-compiler.policy.v1.json"), "utf8"));
  assert.equal(policy.baseline.recordedAtRevision, "0f8c85e");
  assert.equal(policy.baseline.lines, 1495);
  assert.equal(policy.baseline.files, 13);
  const declared = new Set(policy.surface.map((item) => item.path));
  const actualSurface = sourceFiles(path.join(REPO_ROOT, "tools", "src", "execution-graph"))
    .map((file) => path.relative(REPO_ROOT, file).replaceAll("\\", "/"));
  assert.deepEqual(actualSurface.filter((file) => !declared.has(file)), [], "BOOTSTRAP_SURFACE_EXPANSION: undeclared file");
  const lineCount = actualSurface.reduce((total, file) => {
    const source = fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
    return total + source.split(/\r?\n/).length - (source.endsWith("\n") ? 1 : 0);
  }, 0);
  assert.ok(actualSurface.length <= policy.baseline.files, `BOOTSTRAP_SURFACE_EXPANSION: ${actualSurface.length} files`);
  assert.ok(lineCount <= policy.baseline.lines, `BOOTSTRAP_SURFACE_EXPANSION: ${lineCount} lines > ${policy.baseline.lines}`);

  const plan = fs.readFileSync(path.join(REPO_ROOT, "docs", "single-geometry-execution-graph-implementation-plan.md"), "utf8");
  const claimsHarnessClosure = /\| \*\*H — Harness migration\*\* \| Closed \|/.test(plan);
  if (policy.projectionObligation === "OPEN") {
    assert.equal(claimsHarnessClosure, false, "Workstream H cannot claim closure while its aggregate admission gate is open.");
    return;
  }
  assert.equal(policy.projectionObligation, "CLOSED");
  const successorRoot = path.join(REPO_ROOT, policy.replacement.successorRoot);
  const evidencePath = path.join(successorRoot, "self-hosting-equivalence.evidence.json");
  assert.ok(fs.existsSync(successorRoot) && fs.existsSync(evidencePath), policy.replacement.overdueDisposition);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.disposition, "ADMITTED", policy.replacement.overdueDisposition);
  assert.equal(actualSurface.length, 0, policy.replacement.overdueDisposition);
});
