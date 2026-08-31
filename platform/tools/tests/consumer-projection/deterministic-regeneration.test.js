"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");
const { NodePlatformCapabilityRepository } = require("../../../artifacts/tools/dist/adapters/consumer-projection/node-platform-capability-repository.js");
const { resolvePlatformMechanics } = require("../../../artifacts/tools/dist/consumer-projection/authority/platform-responsibility-resolver.js");

const WORKSPACE_ROOT = createReferenceWorkspace();
const PROJECTED_DIR = path.join(WORKSPACE_ROOT, "projected");

function removeStagingDirs() {
  for (const name of fs.readdirSync(WORKSPACE_ROOT)) {
    if (name.startsWith(".projected.") && name.includes("stage")) {
      fs.rmSync(path.join(WORKSPACE_ROOT, name), { recursive: true, force: true });
    }
  }
}

function snapshot(dir) {
  const files = new Map();
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ["bin", "obj"].includes(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.set(path.relative(PROJECTED_DIR, full), fs.readFileSync(full, "utf8"));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return files;
}

function mapsEqual(left, right) {
  if (left.size !== right.size) return false;
  return [...left].every(([key, value]) => right.get(key) === value);
}

function deleteProjectionArtifacts(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory() && ["bin", "obj"].includes(entry.name)) continue;
    if (entry.isDirectory()) deleteProjectionArtifacts(full);
    if (!entry.isDirectory() || fs.readdirSync(full).length === 0) fs.rmSync(full, { recursive: true, force: true });
  }
}

test("the generic example capability's projected artifacts validate", async () => {
  removeStagingDirs();
  const result = await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT });
  assert.equal(result.scenarios.length, 2);
  assert.equal(result.transitions.length, 1);
  assert.ok(result.capability.capabilityId);
  assert.equal(result.query.requiredClosures.length, 12);
  assert.equal(result.mechanicResolution.disposition, "RESOLVED");
  assert.equal(result.mechanicResolution.resolutions.length, 20);
  assert.ok(result.mechanicResolution.resolutions.every((resolution) => resolution.status === "AVAILABLE"));
  assert.equal(result.expectedTelemetry.scenarios.length, 2);
  assert.ok(Object.values(result.closures).every((closure) => closure.obligationDisposition.kind === "SATISFIED"));
  for (const relativePath of [
    "query/conformance-query.json", "query/platform-mechanic-resolution.json", "telemetry/expected-trace.json",
    "node/conformance-query.generated.mjs", "node/capability-runtime.generated.mjs", "node/generic-cli.generated.mjs",
    "application-binding.json", "projection-conformance.json", "projection-manifest.json", "node/capability.projected.test.mjs"
  ]) assert.ok(fs.existsSync(path.join(PROJECTED_DIR, relativePath)), `missing projected artifact: ${relativePath}`);
});

test("the consumer workspace contains authority but no handwritten executable mechanics", () => {
  removeStagingDirs();
  const handwritten = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "projected" || (entry.isDirectory() && entry.name === "csharp-projection-build")) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:js|mjs|cjs|ts|cs|py|java)$/.test(entry.name)) handwritten.push(full);
    }
  };
  walk(WORKSPACE_ROOT);
  assert.deepEqual(handwritten, []);
});

test("an unknown physical binding resolves to a structured missing-capability result", () => {
  const result = resolvePlatformMechanics({
    requirements: [{ mechanicId: "contract-validation", capabilityKind: "contract-validator", requiredBy: "scenario-contract-admission", requestedCapabilityId: "unknown-validator" }],
    projectionTarget: "node",
    platformCapabilityCatalog: { catalogType: "sda-platform-capability-catalog.v1", capabilities: [] },
    repository: new NodePlatformCapabilityRepository(REPO_ROOT)
  });
  assert.equal(result.disposition, "MISSING");
  assert.deepEqual(result.resolutions[0], {
    mechanicId: "contract-validation", capabilityKind: "contract-validator", requiredBy: "scenario-contract-admission",
    requestedCapabilityId: "unknown-validator", status: "MISSING", reason: "CAPABILITY_NOT_FOUND"
  });
});

test("delete all projected artifacts, rerun, reconstruct identically", async () => {
  removeStagingDirs();
  await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT });
  const before = snapshot(PROJECTED_DIR);
  assert.ok(before.size > 0);
  deleteProjectionArtifacts(PROJECTED_DIR);
  assert.equal(snapshot(PROJECTED_DIR).size, 0);
  await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT });
  assert.ok(mapsEqual(before, snapshot(PROJECTED_DIR)));
});

test("partial targets preserve untargeted artifacts and failed publication preserves admitted output", async () => {
  removeStagingDirs();
  await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT, projectionTargets: ["node", "csharp", "python"] });
  const csharpBefore = snapshot(path.join(PROJECTED_DIR, "csharp"));
  const pythonBefore = snapshot(path.join(PROJECTED_DIR, "python"));
  await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT, projectionTargets: ["node"] });
  assert.ok(mapsEqual(csharpBefore, snapshot(path.join(PROJECTED_DIR, "csharp"))));
  assert.ok(mapsEqual(pythonBefore, snapshot(path.join(PROJECTED_DIR, "python"))));
  const beforeFailure = snapshot(PROJECTED_DIR);
  await assert.rejects(
    projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT, projectionTargets: ["node"], failureInjection: "before-publish" }),
    /INJECTED_PROJECTION_FAILURE/
  );
  assert.ok(mapsEqual(beforeFailure, snapshot(PROJECTED_DIR)));
  assert.deepEqual(fs.readdirSync(WORKSPACE_ROOT).filter((name) => name.startsWith(".projected.") && name.includes("stage")), []);
});
