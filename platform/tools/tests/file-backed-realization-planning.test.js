"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");
const CONTRACTS_ROOT = path.join(REPO_ROOT, "capabilities", "sda-tooling", "realization-planning", "contracts");
const FIXTURE_ROOT = path.join(REPO_ROOT, "examples", "generic-capability", "realization");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function modules() {
  const [fileRegistry, fileAuthority, run, profiles, policyAdapter, projectorAdapter, compilerModel, canonical] = await Promise.all([
    importDist("adapters", "realization-planning", "file-system-immutable-authority-registry.js"),
    importDist("adapters", "realization-planning", "file-system-realization-planning-authority.js"),
    importDist("interfaces", "realization-planning", "run-file-registered.js"),
    importDist("model", "realization-planning-adapter-profile.js"),
    importDist("adapters", "realization-planning", "profiled-realization-policy-decision.js"),
    importDist("adapters", "realization-planning", "profiled-digest-realization-projector.js"),
    importDist("capabilities", "realization-planning", "construct-deterministic-realization-plan", "model.js"),
    importDist("enterprise", "control-plane", "canonical-json.js")
  ]);
  return {
    ...fileRegistry,
    ...fileAuthority,
    ...run,
    ...profiles,
    ...policyAdapter,
    ...projectorAdapter,
    ...compilerModel,
    ...canonical
  };
}

function valueAtPointer(document, pointer) {
  return pointer.slice(1).split("/").reduce((value, token) => value[token.replace(/~1/g, "/").replace(/~0/g, "~")], document);
}

test("the filesystem registry manifest and adapter profiles are closed, admitted, and content-addressed", async () => {
  const { digestAdapterProfile, digestWithoutField, sha256Digest } = await modules();
  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const manifest = readJson(path.join(FIXTURE_ROOT, "registry-manifest.json"));
  const profiles = readJson(path.join(FIXTURE_ROOT, "adapter-profiles.json"));
  for (const [value, schema] of [
    [manifest, "file-authority-registry-manifest.schema.json"],
    [profiles, "realization-adapter-profiles.schema.json"],
    [profiles.policyDecision, "realization-policy-decision-profile.schema.json"],
    [profiles.projector, "realization-projector-profile.schema.json"]
  ]) {
    const result = admission.validate(value, schema);
    assert.equal(result.valid, true, `${schema}: ${JSON.stringify(result.errors)}`);
  }
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  assert.equal(profiles.policyDecision.profileDigest, digestAdapterProfile(profiles.policyDecision));
  assert.equal(profiles.projector.profileDigest, digestAdapterProfile(profiles.projector));
  assert.equal(manifest.registryDigest, digestWithoutField(manifest, "registryDigest"));
  for (const entry of manifest.entries) {
    const document = readJson(path.join(FIXTURE_ROOT, entry.documentRef));
    assert.equal(entry.documentDigest, sha256Digest(valueAtPointer(document, entry.documentPointer)));
  }
});

test("file-backed selectors and admitted adapter profiles close into one deterministic plan", async () => {
  const { canonicalizeJson, runFileRegisteredRealizationPlanning } = await modules();
  const request = readJson(path.join(FIXTURE_ROOT, "fixture.json")).request;
  const options = {
    repositoryRoot: REPO_ROOT,
    registryRoot: FIXTURE_ROOT,
    manifestRef: "registry-manifest.json",
    request,
    policyDecisionProfile: { authorityId: "generic-simulation-policy-decision", selector: "current" },
    projectorProfile: { authorityId: "generic-simulation-projector", selector: "current" }
  };
  const first = await runFileRegisteredRealizationPlanning({ ...options, executionId: "file-plan-one" });
  const exact = await runFileRegisteredRealizationPlanning({
    ...options,
    policyDecisionProfile: {
      authorityId: options.policyDecisionProfile.authorityId,
      selector: first.policyDecisionProfileDigest
    },
    projectorProfile: {
      authorityId: options.projectorProfile.authorityId,
      selector: first.projectorProfileDigest
    },
    executionId: "file-plan-exact"
  });
  assert.equal(first.closure.kernelDisposition, "completed");
  assert.equal(first.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(first.closure.evidence.disposition, "PLANNED");
  assert.equal(exact.closure.evidence.disposition, "PLANNED");
  assert.equal(first.authorityManifestDigest, "sha256:11d79723fd05bd63d456091426d8dbdc27e7d11d24f8a3b09fa50451cd4f2969");
  const target = first.closure.evidence.plan.targetResolutions[0];
  assert.equal(target.policyDecision.evaluatorDigest, first.policyDecisionProfileDigest);
  assert.equal(target.projection.projectorProfileDigest, first.projectorProfileDigest);
  assert.equal(target.policyDecision.evaluatorId, "node-profiled-policy-decision.v1");
  assert.equal(target.projection.projectorId, "node-profiled-digest-projector.v1");
  assert.equal(first.closure.evidence.plan.planDigest, exact.closure.evidence.plan.planDigest);
  assert.equal(canonicalizeJson(first.closure.evidence.plan), canonicalizeJson(exact.closure.evidence.plan));

  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const result = admission.validate(first.closure.evidence, "registry-backed-realization-plan-evidence.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("a loaded filesystem registry is immutable while a fresh load rejects stale documents", async (t) => {
  const { loadFileSystemRealizationPlanningAuthority } = await modules();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-realization-registry-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  fs.cpSync(FIXTURE_ROOT, temporaryRoot, { recursive: true });
  const schemaAdmission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const loaded = loadFileSystemRealizationPlanningAuthority({
    registryRoot: temporaryRoot,
    manifestRef: "registry-manifest.json",
    schemaAdmission
  });
  const before = loaded.registries.intents.resolve("generic-capability-intent", "current");
  assert.ok(before);
  const fixturePath = path.join(temporaryRoot, "fixture.json");
  const changed = readJson(fixturePath);
  changed.intentAuthority.statement = "unadmitted mutation";
  fs.writeFileSync(fixturePath, `${JSON.stringify(changed, null, 2)}\n`);
  const after = loaded.registries.intents.resolve("generic-capability-intent", "current");
  assert.equal(after.value.statement, before.value.statement);
  assert.throws(() => loadFileSystemRealizationPlanningAuthority({
    registryRoot: temporaryRoot,
    manifestRef: "registry-manifest.json",
    schemaAdmission: new AjvSchemaAdmission(CONTRACTS_ROOT)
  }), /document digest is stale/);
});

test("filesystem registry references cannot traverse outside their configured root", async () => {
  const { FileSystemImmutableAuthorityRegistry } = await modules();
  assert.throws(() => new FileSystemImmutableAuthorityRegistry({
    registryRoot: FIXTURE_ROOT,
    manifestRef: "../realization/registry-manifest.json",
    authorityKind: "INTENT",
    schemaAdmission: new AjvSchemaAdmission(CONTRACTS_ROOT),
    verifyAuthority: () => true
  }), /escapes its registry root/);
});

test("profiled adapters reject configuration changed after admission", async () => {
  const {
    ProfiledDigestRealizationProjector,
    ProfiledRealizationPolicyDecision
  } = await modules();
  const profiles = readJson(path.join(FIXTURE_ROOT, "adapter-profiles.json"));
  assert.throws(() => new ProfiledRealizationPolicyDecision({
    ...profiles.policyDecision,
    maximumMinimumWarmInstances: 1
  }), /failed digest verification/);
  assert.throws(() => new ProfiledDigestRealizationProjector({
    ...profiles.projector,
    projectorId: "substituted-projector.v1"
  }), /failed digest verification/);
});

test("a rehashed registry manifest cannot substitute an authority schema", async (t) => {
  const {
    digestWithoutField,
    loadFileSystemRealizationPlanningAuthority
  } = await modules();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-realization-schema-binding-"));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  fs.cpSync(FIXTURE_ROOT, temporaryRoot, { recursive: true });
  const manifestPath = path.join(temporaryRoot, "registry-manifest.json");
  const manifest = readJson(manifestPath);
  manifest.entries.find((entry) => entry.authorityKind === "INTENT").schemaFilename = "environment-profile.schema.json";
  manifest.registryDigest = digestWithoutField(manifest, "registryDigest");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.throws(() => loadFileSystemRealizationPlanningAuthority({
    registryRoot: temporaryRoot,
    manifestRef: "registry-manifest.json",
    schemaAdmission: new AjvSchemaAdmission(CONTRACTS_ROOT)
  }), /does not use the trusted schema/);
});

test("configured adapter profile selectors fail closed without fallback", async () => {
  const { runFileRegisteredRealizationPlanning } = await modules();
  const request = readJson(path.join(FIXTURE_ROOT, "fixture.json")).request;
  await assert.rejects(() => runFileRegisteredRealizationPlanning({
    repositoryRoot: REPO_ROOT,
    registryRoot: FIXTURE_ROOT,
    manifestRef: "registry-manifest.json",
    request,
    policyDecisionProfile: {
      authorityId: "generic-simulation-policy-decision",
      selector: "missing"
    },
    projectorProfile: {
      authorityId: "generic-simulation-projector",
      selector: "current"
    }
  }), /policy-decision profile did not resolve/);
});
