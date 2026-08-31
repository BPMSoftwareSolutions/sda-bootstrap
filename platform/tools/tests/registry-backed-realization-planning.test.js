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
const FIXTURE_ROOT = path.join(REPO_ROOT, "examples", "generic-capability", "realization");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const [adapter, compilerModel, run, provider, canonical, referenceProviders] = await Promise.all([
    importDist("adapters", "realization-planning", "in-memory-immutable-authority-registry.js"),
    importDist("capabilities", "realization-planning", "construct-deterministic-realization-plan", "model.js"),
    importDist("interfaces", "realization-planning", "run-registered.js"),
    importDist("capabilities", "realization-planning", "resolve-registered-realization-plan", "provider.js"),
    importDist("enterprise", "control-plane", "canonical-json.js"),
    importDist("interfaces", "realization-planning", "reference-providers.js")
  ]);
  return { ...adapter, ...compilerModel, ...run, ...provider, ...canonical, ...referenceProviders };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fixture() {
  return readJson(path.join(FIXTURE_ROOT, "fixture.json"));
}

async function registriesFromFixture(value) {
  const { InMemoryImmutableAuthorityRegistry, digestCapabilityGraph, digestWithoutField } = await modules();
  const registry = (authorityId, digest, aliases, authority, verify) =>
    new InMemoryImmutableAuthorityRegistry([{ authorityId, digest, aliases, value: authority }], verify);
  return {
    intents: registry(
      value.intentAuthority.intentId,
      value.intentAuthority.authorityDigest,
      value.aliases.intent,
      value.intentAuthority,
      (authority, digest, authorityId) => authority.intentId === authorityId && authority.authorityDigest === digest && digestWithoutField(authority, "authorityDigest") === digest
    ),
    registrations: registry(
      value.capabilityRegistration.registrationId,
      value.capabilityRegistration.registrationDigest,
      value.aliases.capabilityRegistration,
      value.capabilityRegistration,
      (authority, digest, authorityId) => authority.registrationId === authorityId && authority.registrationDigest === digest && digestWithoutField(authority, "registrationDigest") === digest
    ),
    policies: registry(
      value.realizationPolicy.policyId,
      value.realizationPolicy.policyDigest,
      value.aliases.realizationPolicy,
      value.realizationPolicy,
      (authority, digest, authorityId) => authority.policyId === authorityId && authority.policyDigest === digest && digestWithoutField(authority, "policyDigest") === digest
    ),
    environmentProfiles: registry(
      value.environmentProfiles[0].profileId,
      value.environmentProfiles[0].profileDigest,
      value.aliases.environmentProfile,
      value.environmentProfiles[0],
      (authority, digest, authorityId) => authority.profileId === authorityId && authority.profileDigest === digest && digestWithoutField(authority, "profileDigest") === digest
    ),
    capabilityGraphs: registry(
      value.capabilityGraph.capabilityId,
      value.capabilityGraph.graphDigest,
      value.aliases.capabilityGraph,
      value.capabilityGraph,
      (authority, digest, authorityId) => authority.capabilityId === authorityId && authority.graphDigest === digest && digestCapabilityGraph(authority.entries) === digest
    ),
    providerCatalogs: registry(
      value.providerCatalog.catalogId,
      value.providerCatalog.catalogDigest,
      value.aliases.providerCatalog,
      value.providerCatalog,
      (authority, digest, authorityId) => authority.catalogId === authorityId && authority.catalogDigest === digest && digestWithoutField(authority, "catalogDigest") === digest
    ),
    planningSnapshots: registry(
      value.planningSnapshot.snapshotId,
      value.planningSnapshot.snapshotDigest,
      value.aliases.planningSnapshot,
      value.planningSnapshot,
      (authority, digest, authorityId) => authority.snapshotId === authorityId && authority.snapshotDigest === digest && digestWithoutField(authority, "snapshotDigest") === digest
    )
  };
}

test("the checked-in generic realization fixture is schema-admitted and pinned to source authority", async () => {
  const { sha256Digest, digestCapabilityGraph, digestWithoutField } = await modules();
  const value = fixture();
  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const validations = [
    [value, "realization-planning-fixture.schema.json"],
    [value.intentAuthority, "intent-authority.schema.json"],
    [value.capabilityRegistration, "capability-registration.schema.json"],
    [value.realizationPolicy, "realization-policy.schema.json"],
    [value.environmentProfiles[0], "environment-profile.schema.json"],
    [value.capabilityGraph, "capability-graph-authority.schema.json"],
    [value.providerCatalog, "provider-catalog-snapshot.schema.json"],
    [value.planningSnapshot, "planning-authority-snapshot.schema.json"],
    [value.request, "registry-backed-realization-plan-request.schema.json"]
  ];
  for (const [instance, schema] of validations) {
    const result = admission.validate(instance, schema);
    assert.equal(result.valid, true, `${schema}: ${JSON.stringify(result.errors)}`);
  }
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  assert.equal(value.intentAuthority.authorityDigest, digestWithoutField(value.intentAuthority, "authorityDigest"));
  assert.equal(value.capabilityRegistration.registrationDigest, digestWithoutField(value.capabilityRegistration, "registrationDigest"));
  assert.equal(value.capabilityGraph.graphDigest, digestCapabilityGraph(value.capabilityGraph.entries));
  assert.equal(value.providerCatalog.catalogDigest, digestWithoutField(value.providerCatalog, "catalogDigest"));
  assert.equal(value.planningSnapshot.snapshotDigest, digestWithoutField(value.planningSnapshot, "snapshotDigest"));

  const source = (name) => readJson(path.resolve(FIXTURE_ROOT, value.sourceRefs[name]));
  assert.equal(value.capabilityRegistration.releases[0].bundleDigest, sha256Digest(source("capabilityAuthority")));
  assert.equal(value.planningSnapshot.interfaceAuthorityDigest, sha256Digest(source("interfaceAuthority")));
  assert.ok(value.planningSnapshot.contractDigests.includes(sha256Digest(source("executionAuthorities"))));
  assert.ok(value.planningSnapshot.contractDigests.includes(sha256Digest(source("fixtureAuthority"))));
  assert.equal(value.planningSnapshot.projectorDigest, sha256Digest(source("projectionAuthorities")));
});

test("friendly registry selectors close through the scenario host into one deterministic plan", async () => {
  const { runRegisteredRealizationPlanning } = await modules();
  const value = fixture();
  const run = await runRegisteredRealizationPlanning({
    repositoryRoot: REPO_ROOT,
    request: value.request,
    registries: await registriesFromFixture(value),
    executionId: "registered-realization-plan-fixture"
  });
  assert.equal(run.closure.kernelDisposition, "completed");
  assert.equal(run.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(run.closure.experienceDisposition, "REALIZED");
  assert.ok(run.closure.evidence);
  assert.equal(run.closure.evidence.disposition, "PLANNED");
  assert.equal(run.closure.evidence.resolutionDecisions.length, 8);
  assert.equal(run.closure.evidence.resolutionDecisions.filter((decision) => decision.resolvedBy === "ALIAS").length, 6);
  assert.equal(run.closure.evidence.resolutionDecisions.filter((decision) => decision.resolvedBy === "DIGEST").length, 2);
  assert.equal(run.closure.evidence.plan.capabilityRelease.capabilityId, "capability-a");
  assert.equal(run.closure.evidence.plan.providerCatalogId, "generic-simulation-catalog");
  assert.deepEqual(run.closure.evidence.plan.targetResolutions.map((target) => target.targetId), ["simulation-east"]);
  const target = run.closure.evidence.plan.targetResolutions[0];
  assert.equal(target.policyDecision.disposition, "PERMITTED");
  assert.equal(target.projection.actions.length, target.providerBindings.length);

  const lifecycle = readJson(path.join(FIXTURE_ROOT, "lifecycle-fixture.json"));
  assert.equal(lifecycle.lineage.planDigest, run.closure.evidence.plan.planDigest);
  assert.equal(lifecycle.lineage.policyDecisionDigest, target.policyDecision.decisionDigest);
  assert.equal(lifecycle.stages[0].inputDigests.includes(target.projection.projectionDigest), true);

  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const result = admission.validate(run.closure.evidence, "registry-backed-realization-plan-evidence.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("alias and exact-digest requests compile to the same content-addressed plan", async () => {
  const { createReferenceRegisteredRealizationPlanProvider, canonicalizeJson } = await modules();
  const value = fixture();
  const registries = await registriesFromFixture(value);
  const exact = structuredClone(value.request);
  exact.intent.selector = value.intentAuthority.authorityDigest;
  exact.capabilityRegistration.selector = value.capabilityRegistration.registrationDigest;
  exact.capabilityRelease.selector = value.capabilityRegistration.releases[0].bundleDigest;
  exact.realizationPolicy.selector = value.realizationPolicy.policyDigest;
  exact.targets[0].environmentProfile.selector = value.environmentProfiles[0].profileDigest;
  exact.planningSnapshot.selector = value.planningSnapshot.snapshotDigest;

  const provider = createReferenceRegisteredRealizationPlanProvider(registries);
  const byAlias = await provider.execute(value.request);
  const byDigest = await provider.execute(exact);
  assert.equal(byAlias.disposition, "PLANNED");
  assert.equal(byDigest.disposition, "PLANNED");
  assert.equal(byAlias.plan.planDigest, byDigest.plan.planDigest);
  assert.equal(canonicalizeJson(byAlias.plan), canonicalizeJson(byDigest.plan));
  assert.equal(byDigest.resolutionDecisions.every((decision) => decision.resolvedBy === "DIGEST"), true);
});

test("multiple targets may share one profile revision without duplicating authority", async () => {
  const { createReferenceRegisteredRealizationPlanProvider } = await modules();
  const value = fixture();
  const request = structuredClone(value.request);
  request.targets.push({
    targetId: "simulation-west",
    environmentProfile: structuredClone(request.targets[0].environmentProfile)
  });
  const evidence = await createReferenceRegisteredRealizationPlanProvider(await registriesFromFixture(value)).execute(request);
  assert.equal(evidence.disposition, "PLANNED");
  assert.deepEqual(evidence.plan.targetResolutions.map((target) => target.targetId), ["simulation-east", "simulation-west"]);
  assert.equal(evidence.resolutionDecisions.filter((decision) => decision.authorityKind === "ENVIRONMENT_PROFILE").length, 2);
});

test("one plan cannot select two revisions under the same environment-profile identity", async () => {
  const {
    InMemoryImmutableAuthorityRegistry,
    createReferenceRegisteredRealizationPlanProvider,
    digestWithoutField
  } = await modules();
  const value = fixture();
  const secondProfile = structuredClone(value.environmentProfiles[0]);
  secondProfile.version = "2.0.0";
  secondProfile.profileDigest = digestWithoutField(secondProfile, "profileDigest");
  const registries = await registriesFromFixture(value);
  registries.environmentProfiles = new InMemoryImmutableAuthorityRegistry([
    {
      authorityId: value.environmentProfiles[0].profileId,
      digest: value.environmentProfiles[0].profileDigest,
      aliases: ["v1"],
      value: value.environmentProfiles[0]
    },
    {
      authorityId: secondProfile.profileId,
      digest: secondProfile.profileDigest,
      aliases: ["v2"],
      value: secondProfile
    }
  ], (authority, digest, authorityId) =>
    authority.profileId === authorityId &&
    authority.profileDigest === digest &&
    digestWithoutField(authority, "profileDigest") === digest);
  const request = structuredClone(value.request);
  request.targets[0].environmentProfile.selector = "v1";
  request.targets[0].environmentProfile.expectedDigest = value.environmentProfiles[0].profileDigest;
  request.targets.push({
    targetId: "simulation-west",
    environmentProfile: {
      profileId: secondProfile.profileId,
      selector: "v2",
      expectedDigest: secondProfile.profileDigest
    }
  });

  const evidence = await createReferenceRegisteredRealizationPlanProvider(registries).execute(request);
  assert.equal(evidence.disposition, "BLOCKED");
  assert.deepEqual(evidence.findings.map((finding) => finding.code), ["ENVIRONMENT_PROFILE_SELECTOR_CONFLICT"]);
  assert.equal("plan" in evidence, false);
});

test("registry values are defensive immutable copies and ambiguous aliases are rejected", async () => {
  const { InMemoryImmutableAuthorityRegistry, sha256Digest } = await modules();
  const value = fixture();
  const registries = await registriesFromFixture(value);
  const resolution = registries.intents.resolve(value.intentAuthority.intentId, "current");
  assert.ok(resolution);
  assert.equal(Object.isFrozen(resolution.value), true);
  assert.equal(Object.isFrozen(resolution.value.requiredScenarioIds), true);
  value.intentAuthority.statement = "mutated caller object";
  assert.notEqual(resolution.value.statement, value.intentAuthority.statement);
  assert.throws(() => { resolution.value.statement = "mutated registry value"; }, TypeError);

  const firstDigest = sha256Digest({ revision: 1 });
  const secondDigest = sha256Digest({ revision: 2 });
  assert.throws(() => new InMemoryImmutableAuthorityRegistry([
    { authorityId: "authority-a", digest: firstDigest, aliases: ["current"], value: { revision: 1 } },
    { authorityId: "authority-a", digest: secondDigest, aliases: ["current"], value: { revision: 2 } }
  ], () => true), /ambiguous/);
});

test("stale and missing selectors produce stable governed findings without a plan", async () => {
  const { createReferenceRegisteredRealizationPlanProvider } = await modules();
  const value = fixture();
  const provider = createReferenceRegisteredRealizationPlanProvider(await registriesFromFixture(value));

  const stale = structuredClone(value.request);
  stale.intent.expectedDigest = `sha256:${"0".repeat(64)}`;
  const staleEvidence = await provider.execute(stale);
  assert.equal(staleEvidence.disposition, "BLOCKED");
  assert.deepEqual(staleEvidence.findings.map((finding) => finding.code), ["SELECTOR_DIGEST_STALE"]);
  assert.equal("plan" in staleEvidence, false);

  const missingSnapshot = structuredClone(value.request);
  missingSnapshot.planningSnapshot.selector = "missing";
  delete missingSnapshot.planningSnapshot.expectedDigest;
  const missingEvidence = await provider.execute(missingSnapshot);
  assert.equal(missingEvidence.disposition, "BLOCKED");
  assert.deepEqual(missingEvidence.findings.map((finding) => finding.code), ["PLANNING_SNAPSHOT_SELECTOR_NOT_FOUND"]);
  assert.equal("plan" in missingEvidence, false);
});
