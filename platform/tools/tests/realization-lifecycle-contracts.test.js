"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");
const CONTRACTS_ROOT = path.join(REPO_ROOT, "capabilities", "sda-tooling", "realization-planning", "contracts");
const FIXTURE_PATH = path.join(REPO_ROOT, "examples", "generic-capability", "realization", "lifecycle-fixture.json");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
}

async function modules() {
  const [lifecycle, provider, run] = await Promise.all([
    importDist("model", "realization-lifecycle.js"),
    importDist("capabilities", "realization-planning", "verify-realization-lifecycle-contracts", "provider.js"),
    importDist("interfaces", "realization-planning", "verify-lifecycle.js")
  ]);
  return { ...lifecycle, ...provider, ...run };
}

test("the lifecycle fixture admits every closed contract and preserves content addresses", async () => {
  const value = fixture();
  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const validations = [
    [value, "realization-lifecycle-fixture.schema.json"],
    [value.lineage, "causal-realization-lineage.schema.json"],
    ...value.stages.map((stage) => [stage, "realization-stage-evidence.schema.json"]),
    [value.proof, "realization-proof.schema.json"],
    [value.availability, "capability-availability.schema.json"]
  ];
  for (const [instance, schema] of validations) {
    const result = admission.validate(instance, schema);
    assert.equal(result.valid, true, `${schema}: ${JSON.stringify(result.errors)}`);
  }
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);

  const {
    capabilityAvailabilityIsCoherent,
    digestLifecycleArtifact,
    realizationProofIsCoherent,
    stageEvidenceChainIsCoherent
  } = await modules();
  assert.equal(value.lineage.lineageDigest, digestLifecycleArtifact(value.lineage, "lineageDigest"));
  assert.equal(stageEvidenceChainIsCoherent(value.stages), true);
  assert.equal(realizationProofIsCoherent(value.proof), true);
  assert.equal(capabilityAvailabilityIsCoherent(value.availability), true);
});

test("lifecycle coherence closes through the governed scenario host", async () => {
  const { verifyRealizationLifecycle } = await modules();
  const run = await verifyRealizationLifecycle({
    repositoryRoot: REPO_ROOT,
    fixture: fixture(),
    executionId: "generic-lifecycle-contract-verification"
  });
  assert.equal(run.closure.kernelDisposition, "completed");
  assert.equal(run.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(run.closure.experienceDisposition, "REALIZED");
  assert.equal(run.closure.evidence.disposition, "COHERENT");
  assert.deepEqual(run.closure.evidence.findings, []);

  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const result = admission.validate(run.closure.evidence, "realization-lifecycle-contract-evidence.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("incomplete why-running lineage cannot contribute to satisfied proof", async () => {
  const { VerifyRealizationLifecycleContractsProvider, digestLifecycleArtifact } = await modules();
  const value = fixture();
  const previousProofDigest = value.proof.proofDigest;
  value.proof.targetProofs[0].lineageDisposition = "INCOMPLETE";
  value.proof.proofDigest = digestLifecycleArtifact(value.proof, "proofDigest");
  value.availability.latestProof.proofDigest = value.proof.proofDigest;
  value.availability.derivationInputDigests = value.availability.derivationInputDigests
    .map((digest) => digest === previousProofDigest ? value.proof.proofDigest : digest);
  value.availability.derivationInputDigests.sort();
  value.availability.availabilityDigest = digestLifecycleArtifact(value.availability, "availabilityDigest");

  const evidence = await new VerifyRealizationLifecycleContractsProvider().execute(value);
  assert.equal(evidence.disposition, "BLOCKED");
  assert.ok(evidence.findings.some((finding) => finding.code === "PROOF_INCOHERENT"));

  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  assert.equal(admission.validate(value.proof, "realization-proof.schema.json").valid, false);
});

test("cold availability retains registration and historical proof after eviction", async () => {
  const { VerifyRealizationLifecycleContractsProvider, digestLifecycleArtifact } = await modules();
  const value = fixture();
  assert.equal(value.availability.state, "COLD");
  assert.equal(value.availability.capabilityRegistration.state, "REGISTERED");
  assert.deepEqual(value.availability.activeTargetRealizationIds, []);
  assert.equal(value.availability.latestProof.proofDigest, value.proof.proofDigest);

  value.availability.latestProof = null;
  value.availability.availabilityDigest = digestLifecycleArtifact(value.availability, "availabilityDigest");
  const evidence = await new VerifyRealizationLifecycleContractsProvider().execute(value);
  assert.equal(evidence.disposition, "BLOCKED");
  assert.deepEqual(evidence.findings.map((finding) => finding.code), ["AVAILABILITY_PROOF_HISTORY_MISSING"]);
});

test("stage evidence must remain one ordered immutable predecessor chain", async () => {
  const { VerifyRealizationLifecycleContractsProvider, digestLifecycleArtifact } = await modules();
  const value = fixture();
  value.stages[1].previousStageEvidenceDigest = value.lineage.lineageDigest;
  value.stages[1].evidenceDigest = digestLifecycleArtifact(value.stages[1], "evidenceDigest");
  const evidence = await new VerifyRealizationLifecycleContractsProvider().execute(value);
  assert.equal(evidence.disposition, "BLOCKED");
  assert.ok(evidence.findings.some((finding) => finding.code === "STAGE_EVIDENCE_CHAIN_INVALID"));
});
