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
  const [run, provider, obligation, repository] = await Promise.all([
    importDist("interfaces", "workspace-placement-verification", "run.js"),
    importDist("capabilities", "workspace-governance", "verify-governed-placement", "provider.js"),
    importDist("capabilities", "workspace-governance", "verify-governed-placement", "obligation.js"),
    importDist("adapters", "workspace", "node-workspace-governance-repository.js")
  ]);
  return { ...run, ...provider, ...obligation, ...repository };
}

function fact(sourceRef, value) {
  return { sourceRef, digest: `sha256:${"0".repeat(64)}`, observedAt: "2026-08-10T00:00:00.000Z", value };
}

function document(sourceRef, value, valid = true) {
  return {
    fact: fact(sourceRef, value),
    validation: fact(`${sourceRef}#/validation`, {
      valid,
      errors: valid ? [] : [{ instancePath: "/fixtureId", message: "must be string" }]
    })
  };
}

test("repository authority satisfies governed placement through the TypeScript scenario", async () => {
  const { runWorkspacePlacementVerification } = await modules();
  const result = await runWorkspacePlacementVerification({
    repositoryRoot: REPO_ROOT,
    executionId: "parity-governed-placement"
  });
  assert.equal(result.closure.evidence.conforming, true);
  assert.deepEqual(result.closure.evidence.violations, []);
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

test("workspace discovery distinguishes kernel claims from other language conformance documents", async () => {
  const { NodeWorkspaceGovernanceRepository } = await modules();
  const repository = new NodeWorkspaceGovernanceRepository(REPO_ROOT, {
    now: () => "2026-08-11T00:00:00.000Z"
  });
  const input = repository.loadGovernedPlacement();
  const claims = input.languageConformanceClaims.map((claim) => claim.fact.sourceRef);
  assert.equal(claims.length, 6);
  assert.equal(claims.every((claim) => claim.endsWith(".conformance.json")), true);
  assert.equal(claims.some((claim) => claim.endsWith("semantic-implementation.json")), false);
  assert.deepEqual(claims.map((claim) => path.basename(claim)).sort(), [
    "scenario-kernel-cpp.conformance.json",
    "scenario-kernel-csharp.conformance.json",
    "scenario-kernel-go.conformance.json",
    "scenario-kernel-java.conformance.json",
    "scenario-kernel-node.conformance.json",
    "scenario-kernel-python.conformance.json"
  ]);
});

test("governed-placement evidence exposes validation, pairing, and boundary findings", async () => {
  const { GovernedPlacementProvider, GovernedPlacementObligation } = await modules();
  const provider = new GovernedPlacementProvider();
  const evidence = await provider.execute({
    corpusExecutionDirectory: "/workspace/conformance/corpus/execution",
    expectationsExecutionDirectory: "/workspace/conformance/expectations/execution",
    fixtures: [
      document("/workspace/conformance/corpus/execution/invalid.json", {}, false),
      document("/workspace/conformance/corpus/execution/unpaired.json", { fixtureId: "fixture-a", expectationId: "missing" })
    ],
    expectations: [
      document("/workspace/conformance/expectations/execution/orphan.json", { expectationId: "expectation-b", fixtureId: "fixture-b" })
    ],
    languageConformanceClaims: [
      { fact: fact("/workspace/languages/typescript/conformance/node.json", { conformanceType: "wrong" }) }
    ],
    sharedConformanceDocuments: [
      { fact: fact("/workspace/conformance/misplaced.json", { conformanceType: "scenario-kernel-implementation-conformance.v1" }) }
    ]
  });
  assert.deepEqual([...new Set(evidence.violations.map((finding) => finding.rule))].sort(), [
    "K006A", "K006C", "K006D", "K006E"
  ]);
  assert.equal(new GovernedPlacementObligation().evaluate(evidence).kind, "NOT_SATISFIED");
});
