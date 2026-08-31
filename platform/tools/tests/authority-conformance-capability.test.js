"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const REPO_ROOT = path.resolve(__dirname, "../..");

const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const [run, provider, obligation] = await Promise.all([
    importDist("interfaces", "authority-conformance", "run.js"),
    importDist(
      "capabilities",
      "kernel-implementation-admission",
      "determine-authority-conformance",
      "provider.js"
    ),
    importDist(
      "capabilities",
      "kernel-implementation-admission",
      "determine-authority-conformance",
      "obligation.js"
    )
  ]);
  return { ...run, ...provider, ...obligation };
}

function fact(sourceRef, value) {
  return { sourceRef, digest: `sha256:${"0".repeat(64)}`, observedAt: "2026-08-09T00:00:00.000Z", value };
}

function assertion(value) {
  return { value, source: `scenario.${value}`, hardCoding: "forbidden" };
}

function input(overrides = {}) {
  const canonical = [assertion("input.contract")];
  const manifest = { dataAuthority: canonical };
  return {
    language: "node",
    manifestPath: "/workspace/languages/typescript/conformance/manifest.json",
    manifest: fact("manifest.json", manifest),
    manifestValidation: fact("manifest.json#/validation", { valid: true }),
    canonicalAuthority: fact("authority.json", { assertions: canonical }),
    sourceInspection: fact("manifest.json#/source", {
      conforming: true,
      sourceRefs: ["scenario-kernel.ts"],
      missingSourceRefs: [],
      checks: [{ value: "input.contract", observed: true }]
    }),
    ...overrides
  };
}

test("repository authority is conforming through the TypeScript scenario", async () => {
  const { runAuthorityConformance } = await modules();
  const result = await runAuthorityConformance({
    repositoryRoot: REPO_ROOT,
    language: "node",
    executionId: "parity-node"
  });
  assert.equal(result.closure.evidence.language, "node");
  assert.equal(result.closure.evidence.manifestFound, true);
  assert.equal(result.closure.evidence.manifestValid, true);
  assert.equal(result.closure.evidence.assertionSetConforming, true);
  assert.equal(result.closure.evidence.sourceInspection.conforming, true);
  assert.equal(result.closure.evidence.conforming, true);
  assert.equal(result.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(result.closure.experienceDisposition, "REALIZED");
  assert.deepEqual(result.observations.map((item) => item.stepId), [
    "admit-input",
    "resolve-event-authority",
    "execute-event-authority",
    "admit-outcome",
    "resolve-disposition"
  ]);
});

test("authority evidence characterizes missing, unexpected, invalid, and unobservable cases", async () => {
  const { AuthorityConformanceProvider, AuthorityConformanceObligation } = await modules();
  const provider = new AuthorityConformanceProvider();
  const obligation = new AuthorityConformanceObligation();

  const missingManifest = await provider.execute(input({ manifest: null, manifestValidation: null, sourceInspection: null }));
  assert.equal(obligation.evaluate(missingManifest).kind, "NOT_OBSERVABLE");

  const missingAssertion = await provider.execute(input({
    manifest: fact("manifest.json", { dataAuthority: [] })
  }));
  assert.equal(missingAssertion.missingAssertions.length, 1);
  assert.equal(obligation.evaluate(missingAssertion).kind, "NOT_SATISFIED");

  const unexpected = assertion("unexpected.authority");
  const unexpectedAssertion = await provider.execute(input({
    manifest: fact("manifest.json", { dataAuthority: [assertion("input.contract"), unexpected] })
  }));
  assert.deepEqual(unexpectedAssertion.unexpectedAssertions, [unexpected]);

  const invalidManifest = await provider.execute(input({
    manifestValidation: fact("manifest.json#/validation", { valid: false })
  }));
  assert.equal(obligation.evaluate(invalidManifest).kind, "NOT_SATISFIED");

  const missingSource = await provider.execute(input({
    sourceInspection: fact("manifest.json#/source", {
      conforming: false,
      sourceRefs: ["missing.ts"],
      missingSourceRefs: ["missing.ts"],
      checks: []
    })
  }));
  assert.equal(obligation.evaluate(missingSource).kind, "NOT_OBSERVABLE");
});
