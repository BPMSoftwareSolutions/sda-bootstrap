"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");
const CONTRACTS_ROOT = path.join(REPO_ROOT, "capabilities", "sda-tooling", "realization-planning", "contracts");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const [model, provider, obligation, canonical, run, policyDecision, projector, referenceProviders] = await Promise.all([
    importDist("capabilities", "realization-planning", "construct-deterministic-realization-plan", "model.js"),
    importDist("capabilities", "realization-planning", "construct-deterministic-realization-plan", "provider.js"),
    importDist("capabilities", "realization-planning", "construct-deterministic-realization-plan", "obligation.js"),
    importDist("enterprise", "control-plane", "canonical-json.js"),
    importDist("interfaces", "realization-planning", "run.js"),
    importDist("adapters", "realization-planning", "on-demand-realization-policy-decision.js"),
    importDist("adapters", "realization-planning", "digest-realization-projector.js"),
    importDist("interfaces", "realization-planning", "reference-providers.js")
  ]);
  return { ...model, ...provider, ...obligation, ...canonical, ...run, ...policyDecision, ...projector, ...referenceProviders };
}

async function validInput() {
  const { digestWithoutField, digestCapabilityGraph, sha256Digest } = await modules();
  const digest = (label) => sha256Digest({ label });
  const withDigest = (value, field) => ({ ...value, [field]: digestWithoutField(value, field) });

  const intentAuthority = withDigest({
    authorityType: "sda-intent-authority.v1",
    intentId: "generic-document-intent",
    version: "1.0.0",
    statement: "Classify an admitted document and explain the result.",
    capabilityId: "generic-capability",
    requiredScenarioIds: ["classify-document", "explain-classification"],
    requiredObligationIds: ["classification-is-produced", "explanation-is-produced"],
    requiredExperienceIds: ["classification-is-usable", "explanation-is-reviewable"],
    admissionEvidenceDigest: digest("intent-admission")
  }, "authorityDigest");

  const capabilityRegistration = withDigest({
    registrationType: "sda-capability-registration.v1",
    registrationId: "generic-capability-registration",
    capabilityId: "generic-capability",
    state: "REGISTERED",
    releases: [{ releaseId: "release-one", aliases: ["v1"], bundleDigest: digest("bundle") }],
    defaultRealizationPolicyId: "simulation-on-demand",
    allowedRealizationPolicyIds: ["simulation-on-demand"],
    allowedEnvironmentProfileIds: ["deterministic-simulation"],
    ownerId: "sda-platform-team",
    admissionEvidenceDigest: digest("registration-admission")
  }, "registrationDigest");

  const realizationPolicy = withDigest({
    realizationPolicyType: "sda-realization-policy.v1",
    policyId: "simulation-on-demand",
    version: "1.0.0",
    activation: { mode: "ON_DEMAND" },
    retention: { warmFor: "PT30M", idleDisposition: "EVICT" },
    capacity: { minimumWarmInstances: 0, scaleToZero: true },
    rehydration: { mode: "AUTOMATIC" },
    placement: { mode: "PROFILE_RESOLVED" },
    admissionEvidenceDigest: digest("policy-admission")
  }, "policyDigest");

  const environmentProfile = withDigest({
    environmentProfileType: "sda-environment-profile.v1",
    profileId: "deterministic-simulation",
    version: "1.0.0",
    environmentClass: "SIMULATION",
    supportedMechanics: ["deterministic-clock", "in-memory-execution"],
    permittedProviderClasses: ["simulation-provider"],
    admissionEvidenceDigest: digest("profile-admission")
  }, "profileDigest");

  const providerCatalog = withDigest({
    catalogType: "sda-provider-catalog-snapshot.v1",
    catalogId: "simulation-provider-catalog",
    providers: [
      {
        providerId: "simulation-classification-provider",
        providerClass: "simulation-provider",
        implementationDigest: digest("classification-provider"),
        responsibilityIds: ["classify-admitted-document"],
        environmentProfileIds: ["deterministic-simulation"],
        mechanics: ["deterministic-clock", "in-memory-execution"]
      },
      {
        providerId: "simulation-explanation-provider",
        providerClass: "simulation-provider",
        implementationDigest: digest("explanation-provider"),
        responsibilityIds: ["explain-classification-result"],
        environmentProfileIds: ["deterministic-simulation"],
        mechanics: ["deterministic-clock", "in-memory-execution"]
      }
    ]
  }, "catalogDigest");

  const capabilityGraph = [
    {
      scenarioId: "classify-document",
      responsibilityId: "classify-admitted-document",
      obligationId: "classification-is-produced",
      experienceId: "classification-is-usable",
      requiredMechanics: ["in-memory-execution", "deterministic-clock"]
    },
    {
      scenarioId: "explain-classification",
      responsibilityId: "explain-classification-result",
      obligationId: "explanation-is-produced",
      experienceId: "explanation-is-reviewable",
      requiredMechanics: ["deterministic-clock"]
    }
  ];

  return {
    inputType: "construct-deterministic-realization-plan-input.v1",
    request: {
      requestType: "sda-realization-plan-request.v1",
      requestId: "plan-request-one",
      planId: "plan-one",
      intentId: "generic-document-intent",
      registrationId: "generic-capability-registration",
      releaseId: "release-one",
      realizationPolicyId: "simulation-on-demand",
      targets: [
        { targetId: "simulation-west", environmentProfileId: "deterministic-simulation" },
        { targetId: "simulation-east", environmentProfileId: "deterministic-simulation" }
      ]
    },
    intentAuthority,
    capabilityRegistration,
    realizationPolicy,
    environmentProfiles: [environmentProfile],
    capabilityGraph,
    capabilityGraphDigest: digestCapabilityGraph(capabilityGraph),
    providerCatalog,
    interfaceAuthorityDigest: digest("interface"),
    contractDigests: [digest("evidence-contract"), digest("input-contract")],
    policySnapshotDigest: digest("policy-snapshot"),
    projectorDigest: digest("projector")
  };
}

function clone(value) {
  return structuredClone(value);
}

test("admitted authority compiles into a schema-valid content-addressed plan", async () => {
  const {
    ConstructDeterministicRealizationPlanObligation,
    runRealizationPlanning,
    sha256Digest
  } = await modules();
  const input = await validInput();
  const run = await runRealizationPlanning({ repositoryRoot: REPO_ROOT, input, executionId: "realization-plan-test" });
  assert.equal(run.closure.kernelDisposition, "completed");
  assert.equal(run.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(run.closure.experienceDisposition, "REALIZED");
  assert.ok(run.observations.length > 0);
  const evidence = run.closure.evidence;

  assert.ok(evidence);
  assert.equal(evidence.disposition, "PLANNED");
  assert.deepEqual(evidence.findings, []);
  const { planDigest, ...planWithoutDigest } = evidence.plan;
  assert.equal(planDigest, sha256Digest(planWithoutDigest));
  assert.deepEqual(evidence.plan.targetResolutions.map((target) => target.targetId), ["simulation-east", "simulation-west"]);
  assert.deepEqual(
    evidence.plan.targetResolutions[0].providerBindings.map((binding) => binding.responsibilityId),
    ["classify-admitted-document", "explain-classification-result"]
  );
  assert.equal(evidence.plan.targetResolutions.every((target) => target.policyDecision.disposition === "PERMITTED"), true);
  assert.equal(evidence.plan.targetResolutions.every((target) =>
    target.projection.actions.length === target.providerBindings.length), true);

  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  assert.equal(admission.validate(input, "construct-deterministic-realization-plan-input.schema.json").valid, true);
  assert.equal(admission.validate(evidence, "realization-plan-compilation-evidence.schema.json").valid, true);

  const obligation = new ConstructDeterministicRealizationPlanObligation().evaluate(evidence);
  assert.equal(obligation.kind, "SATISFIED");
});

test("permuting set-like request and graph inputs produces byte-identical plans", async () => {
  const { createReferenceRealizationPlanProvider, canonicalizeJson } = await modules();
  const input = await validInput();
  const permuted = clone(input);
  permuted.request.targets.reverse();
  permuted.capabilityGraph.reverse();
  permuted.contractDigests.reverse();
  for (const entry of permuted.capabilityGraph) entry.requiredMechanics.reverse();

  const provider = createReferenceRealizationPlanProvider();
  const first = await provider.execute(input);
  const second = await provider.execute(permuted);
  assert.equal(first.disposition, "PLANNED");
  assert.equal(second.disposition, "PLANNED");
  assert.equal(first.plan.planDigest, second.plan.planDigest);
  assert.equal(canonicalizeJson(first.plan), canonicalizeJson(second.plan));
});

test("changing any pinned policy, profile, provider, or projector authority changes the plan digest", async () => {
  const { createReferenceRealizationPlanProvider, digestWithoutField, sha256Digest } = await modules();
  const base = await validInput();
  const provider = createReferenceRealizationPlanProvider();
  const baseline = await provider.execute(base);
  assert.equal(baseline.disposition, "PLANNED");

  const policyChanged = clone(base);
  policyChanged.realizationPolicy.retention.warmFor = "PT45M";
  policyChanged.realizationPolicy.policyDigest = digestWithoutField(policyChanged.realizationPolicy, "policyDigest");

  const profileChanged = clone(base);
  profileChanged.environmentProfiles[0].version = "1.0.1";
  profileChanged.environmentProfiles[0].profileDigest = digestWithoutField(profileChanged.environmentProfiles[0], "profileDigest");

  const providerChanged = clone(base);
  providerChanged.providerCatalog.providers[0].implementationDigest = sha256Digest({ label: "classification-provider-v2" });
  providerChanged.providerCatalog.catalogDigest = digestWithoutField(providerChanged.providerCatalog, "catalogDigest");

  const policySnapshotChanged = clone(base);
  policySnapshotChanged.policySnapshotDigest = sha256Digest({ label: "policy-snapshot-v2" });

  const projectorChanged = clone(base);
  projectorChanged.projectorDigest = sha256Digest({ label: "projector-v2" });

  const changed = await Promise.all([
    provider.execute(policyChanged),
    provider.execute(profileChanged),
    provider.execute(providerChanged),
    provider.execute(policySnapshotChanged),
    provider.execute(projectorChanged)
  ]);
  for (const evidence of changed) {
    assert.equal(evidence.disposition, "PLANNED");
    assert.notEqual(evidence.plan.planDigest, baseline.plan.planDigest);
  }
});

test("the bounded policy port denies unsupported activation without invoking projection", async () => {
  const { createReferenceRealizationPlanProvider, digestWithoutField } = await modules();
  const input = await validInput();
  input.realizationPolicy.activation.mode = "ALWAYS_WARM";
  input.realizationPolicy.policyDigest = digestWithoutField(input.realizationPolicy, "policyDigest");
  const evidence = await createReferenceRealizationPlanProvider().execute(input);
  assert.equal(evidence.disposition, "BLOCKED");
  assert.deepEqual(
    evidence.findings.map((finding) => [finding.code, finding.targetId]),
    [
      ["POLICY_DECISION_DENIED", "simulation-east"],
      ["POLICY_DECISION_DENIED", "simulation-west"]
    ]
  );
});

test("unbound policy and projector port output blocks instead of entering the plan", async () => {
  const {
    ConstructDeterministicRealizationPlanProvider,
    DigestRealizationProjector,
    OnDemandRealizationPolicyDecision,
    digestWithoutField,
    sha256Digest
  } = await modules();
  const input = await validInput();
  const policy = new OnDemandRealizationPolicyDecision();
  const projector = new DigestRealizationProjector();
  const invalidPolicy = {
    decide: async (request) => {
      const candidate = {
        ...await policy.decide(request),
        environmentProfileDigest: sha256Digest({ label: "different-profile" })
      };
      candidate.decisionDigest = digestWithoutField(candidate, "decisionDigest");
      return candidate;
    }
  };
  const invalidPolicyEvidence = await new ConstructDeterministicRealizationPlanProvider(invalidPolicy, projector).execute(input);
  assert.equal(invalidPolicyEvidence.disposition, "BLOCKED");
  assert.deepEqual(
    invalidPolicyEvidence.findings.map((finding) => finding.code),
    ["POLICY_DECISION_INVALID", "POLICY_DECISION_INVALID"]
  );

  const invalidProjector = {
    planProjection: async (request) => {
      const candidate = {
        ...await projector.planProjection(request),
        projectorDigest: sha256Digest({ label: "different-projector" })
      };
      candidate.projectionDigest = digestWithoutField(candidate, "projectionDigest");
      return candidate;
    }
  };
  const invalidProjectionEvidence = await new ConstructDeterministicRealizationPlanProvider(policy, invalidProjector).execute(input);
  assert.equal(invalidProjectionEvidence.disposition, "BLOCKED");
  assert.deepEqual(
    invalidProjectionEvidence.findings.map((finding) => finding.code),
    ["PROJECTOR_OUTPUT_INVALID", "PROJECTOR_OUTPUT_INVALID"]
  );
});

test("revoked registration and mismatched intent block with stable governed findings", async () => {
  const {
    ConstructDeterministicRealizationPlanObligation,
    createReferenceRealizationPlanProvider,
    digestWithoutField
  } = await modules();
  const input = await validInput();
  input.request.intentId = "different-intent";
  input.capabilityRegistration.state = "REVOKED";
  input.capabilityRegistration.registrationDigest = digestWithoutField(input.capabilityRegistration, "registrationDigest");

  const evidence = await createReferenceRealizationPlanProvider().execute(input);
  assert.equal(evidence.disposition, "BLOCKED");
  assert.deepEqual(evidence.findings.map((finding) => finding.code), ["INTENT_MISMATCH", "REGISTRATION_NOT_ELIGIBLE"]);
  assert.equal("plan" in evidence, false);
  assert.equal(new ConstructDeterministicRealizationPlanObligation().evaluate(evidence).kind, "NOT_SATISFIED");
});

test("missing and ambiguous provider resolution never silently falls back", async () => {
  const { createReferenceRealizationPlanProvider, digestWithoutField } = await modules();
  const provider = createReferenceRealizationPlanProvider();
  const base = await validInput();

  const missing = clone(base);
  missing.providerCatalog.providers = missing.providerCatalog.providers.slice(1);
  missing.providerCatalog.catalogDigest = digestWithoutField(missing.providerCatalog, "catalogDigest");
  const missingEvidence = await provider.execute(missing);
  assert.equal(missingEvidence.disposition, "BLOCKED");
  assert.deepEqual(
    missingEvidence.findings.filter((finding) => finding.code === "PROVIDER_NOT_FOUND").map((finding) => finding.targetId),
    ["simulation-east", "simulation-west"]
  );

  const ambiguous = clone(base);
  ambiguous.providerCatalog.providers.push({
    ...clone(ambiguous.providerCatalog.providers[0]),
    providerId: "alternate-classification-provider"
  });
  ambiguous.providerCatalog.catalogDigest = digestWithoutField(ambiguous.providerCatalog, "catalogDigest");
  const ambiguousEvidence = await provider.execute(ambiguous);
  assert.equal(ambiguousEvidence.disposition, "BLOCKED");
  assert.deepEqual(
    ambiguousEvidence.findings.filter((finding) => finding.code === "PROVIDER_AMBIGUOUS").map((finding) => finding.targetId),
    ["simulation-east", "simulation-west"]
  );
});

test("graph tampering and duplicate authority identities block before a plan is emitted", async () => {
  const { createReferenceRealizationPlanProvider } = await modules();
  const provider = createReferenceRealizationPlanProvider();
  const graphTampered = await validInput();
  graphTampered.capabilityGraph[1].requiredMechanics.push("in-memory-execution");
  const graphEvidence = await provider.execute(graphTampered);
  assert.equal(graphEvidence.disposition, "BLOCKED");
  assert.deepEqual(graphEvidence.findings.map((finding) => finding.code), ["CAPABILITY_GRAPH_DIGEST_MISMATCH"]);

  const duplicateProfile = await validInput();
  duplicateProfile.environmentProfiles.push(clone(duplicateProfile.environmentProfiles[0]));
  const duplicateEvidence = await provider.execute(duplicateProfile);
  assert.equal(duplicateEvidence.disposition, "BLOCKED");
  assert.deepEqual(duplicateEvidence.findings.map((finding) => finding.code), ["DUPLICATE_ENVIRONMENT_PROFILE"]);
});

test("schema admission rejects incomplete authority before semantic planning", async () => {
  const input = await validInput();
  delete input.realizationPolicy.placement;
  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const result = admission.validate(input, "construct-deterministic-realization-plan-input.schema.json");
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.instancePath === "/realizationPolicy"));
});
