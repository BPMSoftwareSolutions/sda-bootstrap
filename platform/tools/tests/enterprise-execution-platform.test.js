"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { generateKeyPairSync } = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const schemaAdmission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"));
const validate = (instance, schemaFilename) => schemaAdmission.validate(instance, schemaFilename);

const DIST = path.join(REPO_ROOT, "artifacts", "tools", "dist");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST, ...segments)).href);
}

async function platform() {
  const modules = await Promise.all([
    importDist("enterprise", "control-plane", "canonical-json.js"),
    importDist("enterprise", "control-plane", "capability-bundle.js"),
    importDist("enterprise", "control-plane", "release-admission.js"),
    importDist("enterprise", "adapters", "in-memory-bundle-registry.js"),
    importDist("enterprise", "adapters", "in-memory-execution-repository.js"),
    importDist("enterprise", "adapters", "in-memory-provider-registry.js"),
    importDist("enterprise", "adapters", "allow-all-invocation-policy.js"),
    importDist("enterprise", "data-plane", "durable-execution-orchestrator.js"),
    importDist("adapters", "node-scenario-kernel", "node-scenario-kernel-runner.js"),
    importDist("adapters", "contracts", "function-contract-admission.js"),
    importDist("adapters", "telemetry", "in-memory-execution-observer.js"),
    importDist("host", "tool-capability-host.js")
  ]);
  return Object.assign({}, ...modules);
}

const capability = {
  capabilityType: "scenario-driven-capability.v2",
  capabilityId: "enterprise-reference-capability",
  purpose: "prove bundle-pinned, tenant-scoped, retryable outer execution around the atomic kernel",
  consumer: { actor: "enterprise operator" },
  interfaces: [],
  scenarios: [{
    scenarioType: "scenario.v2",
    scenarioId: "perform-reference-work",
    input: { inputId: "reference-input", contract: { contractId: "reference-input.v1" } },
    event: {
      eventId: "reference-work-requested",
      responsibility: {
        responsibilityId: "perform-reference-work",
        statement: "produce admitted reference evidence"
      },
      executionAuthorityId: "reference-work-authority.v1"
    },
    outcome: {
      outcomeId: "reference-work-known",
      obligation: {
        obligationId: "reference-evidence-is-present",
        statement: "reference evidence is present",
        observableConditions: [{
          conditionId: "reference-value-observed",
          statement: "the admitted evidence contains a value"
        }]
      },
      evidence: { contract: { contractId: "reference-evidence.v1" } },
      experience: {
        experienceId: "reference-work-is-visible",
        actor: "enterprise operator",
        promise: "the operator can observe completed reference work"
      }
    }
  }]
};

const providerBindings = {
  bindingType: "responsibility-provider-bindings.v1",
  bindings: [{
    responsibilityId: "perform-reference-work",
    providerId: "node-reference-provider.v1",
    implementationRef: "artifacts/tools/dist/tests/reference-provider.js",
    requires: ["durable-orchestration"]
  }]
};

const observationBindings = {
  bindingType: "observation-bindings.v1",
  bindings: [{
    conditionId: "reference-value-observed",
    evaluatorId: "reference-evidence-evaluator.v1",
    evidenceContractId: "reference-evidence.v1"
  }]
};

function bundleInput(digest, overrides = {}) {
  return {
    bundleId: "enterprise-reference-bundle",
    version: "1.0.0",
    capability: overrides.capability ?? capability,
    providerBindings: overrides.providerBindings ?? providerBindings,
    observationBindings: overrides.observationBindings ?? observationBindings,
    authorities: [{
      authorityId: "enterprise-reference-authority",
      mediaType: "application/json",
      fact: {
        sourceRef: "capabilities/enterprise-reference/capability.json",
        digest,
        observedAt: "2026-08-09T00:00:00.000Z",
        value: capability
      }
    }],
    provenance: {
      sourceRevision: "0123456789abcdef",
      projectorDigest: `sha256:${"1".repeat(64)}`,
      toolchain: "node-24-typescript-5.9",
      builtAt: "2026-08-09T00:00:00.000Z",
      sbomRef: "sbom/enterprise-reference.cdx.json"
    },
    evidence: [{
      gate: "KERNEL_CONFORMANT",
      evidenceRef: "artifacts/conformance/node.json",
      digest: `sha256:${"2".repeat(64)}`
    }]
  };
}

async function executionHarness(
  bundle,
  registry,
  executionPolicy = { maximumAttempts: 1 },
  suppliedClock = null
) {
  const {
    InMemoryBundleRegistry,
    InMemoryExecutionRepository,
    AllowAllInvocationPolicy,
    DurableExecutionOrchestrator,
    NodeScenarioKernelRunner,
    FunctionContractAdmission,
    InMemoryExecutionObserver,
    ToolCapabilityHost
  } = await platform();
  const bundles = new InMemoryBundleRegistry();
  bundles.register(bundle);
  const executions = new InMemoryExecutionRepository();
  const contracts = new FunctionContractAdmission(new Map([
    ["reference-input.v1", (value) => Boolean(value && typeof value === "object")],
    ["reference-evidence.v1", (value) => Boolean(value && typeof value === "object")]
  ]));
  const observer = new InMemoryExecutionObserver();
  const host = new ToolCapabilityHost(new NodeScenarioKernelRunner(REPO_ROOT), contracts, observer);
  let tick = 0;
  const clock = suppliedClock ?? {
    now: () => new Date(Date.parse("2026-08-09T00:00:00.000Z") + tick++).toISOString()
  };
  return {
    executions,
    observer,
    orchestrator: new DurableExecutionOrchestrator(
      bundles,
      executions,
      registry,
      new AllowAllInvocationPolicy(),
      host,
      executionPolicy,
      clock
    )
  };
}

function registeredReferenceProvider(registry, execute = async (input) => input) {
  registry.registerProvider({
    providerId: "node-reference-provider.v1",
    responsibilityId: "perform-reference-work",
    implementationRef: "artifacts/tools/dist/tests/reference-provider.js",
    requires: ["durable-orchestration"],
    execute
  });
}

function registeredReferenceEvaluator(registry, disposition = "SATISFIED", evaluatorId = "reference-evidence-evaluator.v1") {
  registry.registerEvaluator({
    evaluatorId,
    evidenceContractId: "reference-evidence.v1",
    conditionIds: ["reference-value-observed"],
    evaluateCondition: (conditionId) => ({ conditionId, disposition })
  });
}

function request(bundleDigest, executionId = "execution-001") {
  return {
    requestType: "sda-execution-request.v1",
    executionId,
    bundleDigest,
    capabilityId: capability.capabilityId,
    scenarioId: "perform-reference-work",
    idempotencyKey: "tenant-a-reference-001",
    tenant: { tenantId: "tenant-a", homeRegion: "us-east" },
    subject: {
      subjectId: "operator-1",
      issuer: "https://identity.example.test",
      authenticationMethod: "oidc"
    },
    environment: "test",
    region: "us-east",
    purpose: "architecture-conformance",
    dataClassification: "INTERNAL",
    requestedAt: "2026-08-09T00:00:00.000Z",
    input: { value: "accepted" }
  };
}

test("capability bundles are deterministic, signed, content-addressed, and schema-admitted", async () => {
  const {
    compileCapabilityBundle,
    verifyCapabilityBundle,
    signCapabilityBundle,
    verifyCapabilityBundleSignature,
    InMemoryBundleRegistry
  } = await platform();
  const first = compileCapabilityBundle(bundleInput(`sha256:${"a".repeat(64)}`));
  const second = compileCapabilityBundle(bundleInput(`sha256:${"a".repeat(64)}`));
  const changed = compileCapabilityBundle(bundleInput(`sha256:${"b".repeat(64)}`));
  assert.equal(first.bundleDigest, second.bundleDigest);
  assert.notEqual(first.bundleDigest, changed.bundleDigest);
  assert.equal(verifyCapabilityBundle(first), true);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const signed = signCapabilityBundle(first, privateKey, "test-release-key");
  assert.equal(verifyCapabilityBundleSignature(signed, publicKey), true);
  const registry = new InMemoryBundleRegistry(
    (candidate) => verifyCapabilityBundleSignature(candidate, publicKey),
    true
  );
  registry.register(signed);
  assert.throws(() => registry.register(first), /unsigned/);
  const validation = validate(signed, "sda-capability-bundle.schema.json");
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
});

test("environment release admission composes named gates without overloading kernel conformance", async () => {
  const { evaluateReleaseAdmission } = await platform();
  const bundleDigest = `sha256:${"a".repeat(64)}`;
  const gates = ["KERNEL_CONFORMANT", "SECURITY_ACCEPTED", "OPERABILITY_ACCEPTED"];
  const evidence = gates.map((gate, index) => ({
    gate,
    subjectDigest: bundleDigest,
    evidenceType: "sda-gate-evidence",
    evidenceVersion: "1.0.0",
    issuer: "test-release-authority",
    observedAt: "2026-08-08T23:59:00.000Z",
    disposition: "SATISFIED",
    evidenceRef: `evidence/${gate.toLowerCase()}.json`,
    digest: `sha256:${String(index + 3).repeat(64)}`
  }));
  const evidenceTrustPolicy = {
    verify: (item, context) =>
      item.issuer === "test-release-authority" &&
      item.evidenceType === "sda-gate-evidence" &&
      item.evidenceVersion === "1.0.0" &&
      item.evidenceRef.startsWith("evidence/") &&
      /^sha256:[0-9a-f]{64}$/.test(item.digest) &&
      item.subjectDigest === context.bundleDigest
  };
  const admitted = evaluateReleaseAdmission({
    environment: "test",
    bundleDigest,
    requiredGates: gates,
    gateEvidence: evidence,
    maximumEvidenceAgeMilliseconds: 120_000,
    evidenceTrustPolicy,
    clock: { now: () => "2026-08-09T00:00:00.000Z" }
  });
  assert.equal(admitted.disposition, "RELEASE_ADMITTED");
  assert.equal(validate(admitted, "release-admission.schema.json").valid, true);

  const blocked = evaluateReleaseAdmission({
    environment: "production",
    bundleDigest: admitted.bundleDigest,
    requiredGates: [...gates, "DR_ACCEPTED:us-east+us-west"],
    gateEvidence: evidence,
    maximumEvidenceAgeMilliseconds: 120_000,
    evidenceTrustPolicy,
    clock: { now: () => "2026-08-09T00:00:00.000Z" }
  });
  assert.equal(blocked.disposition, "RELEASE_BLOCKED");

  const wrongSubject = evaluateReleaseAdmission({
    environment: "test",
    bundleDigest: `sha256:${"b".repeat(64)}`,
    requiredGates: gates,
    gateEvidence: evidence,
    maximumEvidenceAgeMilliseconds: 120_000,
    evidenceTrustPolicy,
    clock: { now: () => "2026-08-09T00:00:00.000Z" }
  });
  assert.equal(wrongSubject.disposition, "RELEASE_BLOCKED");

  const stale = evaluateReleaseAdmission({
    environment: "test",
    bundleDigest,
    requiredGates: gates,
    gateEvidence: evidence,
    maximumEvidenceAgeMilliseconds: 30_000,
    evidenceTrustPolicy,
    clock: { now: () => "2026-08-09T00:00:00.000Z" }
  });
  assert.equal(stale.disposition, "RELEASE_BLOCKED");
  assert.throws(() => evaluateReleaseAdmission({
    environment: "test",
    bundleDigest,
    requiredGates: gates,
    gateEvidence: [...evidence, evidence[0]],
    maximumEvidenceAgeMilliseconds: 120_000,
    evidenceTrustPolicy,
    clock: { now: () => "2026-08-09T00:00:00.000Z" }
  }), /duplicate gate identities/);
  assert.throws(() => evaluateReleaseAdmission({
    environment: "test",
    bundleDigest,
    requiredGates: [],
    gateEvidence: [],
    maximumEvidenceAgeMilliseconds: 120_000,
    evidenceTrustPolicy,
    clock: { now: () => "2026-08-09T00:00:00.000Z" }
  }), /at least one gate/);

  const untrusted = evaluateReleaseAdmission({
    environment: "test",
    bundleDigest,
    requiredGates: gates,
    gateEvidence: evidence.map((item) => ({ ...item, issuer: "self-asserted-authority" })),
    maximumEvidenceAgeMilliseconds: 120_000,
    evidenceTrustPolicy,
    clock: { now: () => "2026-08-09T00:00:00.000Z" }
  });
  assert.equal(untrusted.disposition, "RELEASE_BLOCKED");
});

test("the outer runtime deduplicates, retries, and preserves tenant/bundle lineage around the five-step kernel", async () => {
  const {
    compileCapabilityBundle,
    InMemoryBundleRegistry,
    InMemoryExecutionRepository,
    InMemoryProviderRegistry,
    AllowAllInvocationPolicy,
    DurableExecutionOrchestrator,
    NodeScenarioKernelRunner,
    FunctionContractAdmission,
    InMemoryExecutionObserver,
    ToolCapabilityHost
  } = await platform();
  const bundle = compileCapabilityBundle(bundleInput(`sha256:${"a".repeat(64)}`));
  const bundles = new InMemoryBundleRegistry();
  bundles.register(bundle);
  const executions = new InMemoryExecutionRepository();
  const providers = new InMemoryProviderRegistry();
  let invocations = 0;
  providers.registerProvider({
    providerId: "decoy-reference-provider.v1",
    responsibilityId: "perform-reference-work",
    implementationRef: "artifacts/tools/dist/tests/decoy-provider.js",
    requires: ["durable-orchestration"],
    execute: async () => {
      throw new Error("the responsibility-level decoy must never be selected");
    }
  });
  providers.registerProvider({
    providerId: "node-reference-provider.v1",
    responsibilityId: "perform-reference-work",
    implementationRef: "artifacts/tools/dist/tests/reference-provider.js",
    requires: ["durable-orchestration"],
    execute: async (input) => {
      invocations += 1;
      if (invocations === 1) throw new Error("transient provider failure");
      return input;
    }
  });
  providers.registerEvaluator({
    evaluatorId: "reference-evidence-evaluator.v1",
    evidenceContractId: "reference-evidence.v1",
    conditionIds: ["reference-value-observed"],
    evaluateCondition: (conditionId, evidence) => ({
      conditionId,
      disposition: evidence && typeof evidence === "object" && typeof evidence.value === "string"
        ? "SATISFIED"
        : "NOT_SATISFIED"
    })
  });
  const contracts = new FunctionContractAdmission(new Map([
    ["reference-input.v1", (value) => Boolean(value && typeof value === "object")],
    ["reference-evidence.v1", (value) => Boolean(value && typeof value === "object")]
  ]));
  const kernelObserver = new InMemoryExecutionObserver();
  const host = new ToolCapabilityHost(
    new NodeScenarioKernelRunner(REPO_ROOT),
    contracts,
    kernelObserver
  );
  let tick = 0;
  const clock = { now: () => new Date(Date.parse("2026-08-09T00:00:00.000Z") + tick++).toISOString() };
  const orchestrator = new DurableExecutionOrchestrator(
    bundles,
    executions,
    providers,
    new AllowAllInvocationPolicy(),
    host,
    { maximumAttempts: 2 },
    clock
  );

  const admittedRequest = request(bundle.bundleDigest);
  assert.equal(validate(admittedRequest, "execution-request.schema.json").valid, true);
  const firstSubmission = await orchestrator.submit(admittedRequest);
  const duplicateSubmission = await orchestrator.submit({ ...admittedRequest, executionId: "execution-duplicate" });
  assert.equal(firstSubmission.duplicate, false);
  assert.equal(duplicateSubmission.duplicate, true);
  assert.equal(duplicateSubmission.record.request.executionId, "execution-001");

  const firstAttempt = await orchestrator.processNext();
  assert.equal(firstAttempt.status, "RETRY_PENDING");
  const secondAttempt = await orchestrator.processNext();
  assert.equal(secondAttempt.status, "COMPLETED");
  assert.equal(secondAttempt.attempt, 2);
  assert.equal(secondAttempt.request.tenant.tenantId, "tenant-a");
  assert.equal(secondAttempt.request.bundleDigest, bundle.bundleDigest);
  assert.equal(secondAttempt.providerId, "node-reference-provider.v1");
  assert.deepEqual(secondAttempt.evaluatorIds, ["reference-evidence-evaluator.v1"]);

  const events = executions.events("execution-001");
  assert.deepEqual(events.map((event) => event.kind), [
    "REQUEST_ADMITTED",
    "DUPLICATE_SUPPRESSED",
    "DISPATCHED",
    "ATTEMPT_STARTED",
    "ATTEMPT_FAILED",
    "RETRY_SCHEDULED",
    "DISPATCHED",
    "ATTEMPT_STARTED",
    "ATTEMPT_COMPLETED"
  ]);
  for (const event of events) {
    const validation = validate(event, "orchestration-event.schema.json");
    assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  }
  assert.deepEqual(
    events.filter((event) => event.providerId).map((event) => event.providerId),
    Array(7).fill("node-reference-provider.v1")
  );
  assert.deepEqual(kernelObserver.observations.map((item) => item.stepId), [
    "admit-input",
    "resolve-event-authority",
    "execute-event-authority",
    "admit-input",
    "resolve-event-authority",
    "execute-event-authority",
    "admit-outcome",
    "resolve-disposition"
  ]);
});

test("dispatch rejects a provider whose runtime identity differs from the bundle binding", async () => {
  const { compileCapabilityBundle } = await platform();
  const bundle = compileCapabilityBundle(bundleInput(`sha256:${"c".repeat(64)}`));
  let invocations = 0;
  const registry = {
    resolveProvider: () => ({
      providerId: "substituted-provider.v1",
      responsibilityId: "perform-reference-work",
      implementationRef: "artifacts/tools/dist/tests/substituted-provider.js",
      requires: ["durable-orchestration"],
      execute: async (input) => {
        invocations += 1;
        return input;
      }
    }),
    resolveEvaluator: () => ({
      evaluatorId: "reference-evidence-evaluator.v1",
      evidenceContractId: "reference-evidence.v1",
      conditionIds: ["reference-value-observed"],
      evaluateCondition: (conditionId) => ({ conditionId, disposition: "SATISFIED" })
    })
  };
  const { orchestrator, executions } = await executionHarness(bundle, registry);
  await orchestrator.submit(request(bundle.bundleDigest, "provider-mismatch"));
  const result = await orchestrator.processNext();
  assert.equal(result.status, "QUARANTINED");
  assert.equal(result.reasonCode, "provider-binding-mismatch");
  assert.equal(invocations, 0);
  assert.equal(executions.events("provider-mismatch").some((event) => event.providerId), false);
});

test("missing or mismatched observation authority prevents dispatch", async () => {
  const { compileCapabilityBundle, InMemoryProviderRegistry } = await platform();
  const missingBundle = compileCapabilityBundle(bundleInput(`sha256:${"d".repeat(64)}`, {
    observationBindings: { bindingType: "observation-bindings.v1", bindings: [] }
  }));
  const missingRegistry = new InMemoryProviderRegistry();
  let invocations = 0;
  registeredReferenceProvider(missingRegistry, async (input) => {
    invocations += 1;
    return input;
  });
  registeredReferenceEvaluator(missingRegistry);
  const missingHarness = await executionHarness(missingBundle, missingRegistry);
  await missingHarness.orchestrator.submit(request(missingBundle.bundleDigest, "missing-observation"));
  const missing = await missingHarness.orchestrator.processNext();
  assert.equal(missing.reasonCode, "observation-binding-incomplete");
  assert.equal(invocations, 0);
  assert.equal(missingHarness.executions.events("missing-observation").some((event) => event.providerId), false);

  const validBundle = compileCapabilityBundle(bundleInput(`sha256:${"e".repeat(64)}`));
  const mismatchedRegistry = {
    resolveProvider: (providerId) => providerId === "node-reference-provider.v1" ? {
      providerId,
      responsibilityId: "perform-reference-work",
      implementationRef: "artifacts/tools/dist/tests/reference-provider.js",
      requires: ["durable-orchestration"],
      execute: async (input) => input
    } : null,
    resolveEvaluator: () => ({
      evaluatorId: "substituted-evaluator.v1",
      evidenceContractId: "reference-evidence.v1",
      conditionIds: ["reference-value-observed"],
      evaluateCondition: (conditionId) => ({ conditionId, disposition: "SATISFIED" })
    })
  };
  const mismatchedHarness = await executionHarness(validBundle, mismatchedRegistry);
  await mismatchedHarness.orchestrator.submit(request(validBundle.bundleDigest, "evaluator-mismatch"));
  const mismatched = await mismatchedHarness.orchestrator.processNext();
  assert.equal(mismatched.reasonCode, "evaluator-binding-mismatch");
  assert.equal(mismatchedHarness.executions.events("evaluator-mismatch").some((event) => event.evaluatorIds), false);
});

test("changing only observation bindings changes evaluation behavior and testimony", async () => {
  const { compileCapabilityBundle, InMemoryProviderRegistry } = await platform();
  const rejectingBindings = {
    bindingType: "observation-bindings.v1",
    bindings: [{
      conditionId: "reference-value-observed",
      evaluatorId: "rejecting-reference-evaluator.v1",
      evidenceContractId: "reference-evidence.v1",
      configurationRef: "policy/reject-reference.v1"
    }]
  };
  const bundle = compileCapabilityBundle(bundleInput(`sha256:${"f".repeat(64)}`, {
    observationBindings: rejectingBindings
  }));
  const registry = new InMemoryProviderRegistry();
  registeredReferenceProvider(registry);
  let configurationObserved = null;
  registry.registerEvaluator({
    evaluatorId: "rejecting-reference-evaluator.v1",
    evidenceContractId: "reference-evidence.v1",
    conditionIds: ["reference-value-observed"],
    evaluateCondition: (conditionId, _evidence, configurationRef) => {
      configurationObserved = configurationRef;
      return { conditionId, disposition: "NOT_SATISFIED" };
    }
  });
  const { orchestrator, executions } = await executionHarness(bundle, registry);
  await orchestrator.submit(request(bundle.bundleDigest, "rejecting-observation"));
  const result = await orchestrator.processNext();
  assert.equal(result.status, "QUARANTINED");
  assert.equal(result.reasonCode, "obligation-not-satisfied");
  assert.equal(configurationObserved, "policy/reject-reference.v1");
  assert.deepEqual(result.evaluatorIds, ["rejecting-reference-evaluator.v1"]);
  assert.deepEqual(
    executions.events("rejecting-observation").filter((event) => event.evaluatorIds).map((event) => event.evaluatorIds),
    Array(4).fill(["rejecting-reference-evaluator.v1"])
  );
});

test("an evaluator cannot satisfy a condition other than the one bound by the bundle", async () => {
  const { compileCapabilityBundle, InMemoryProviderRegistry } = await platform();
  const bundle = compileCapabilityBundle(bundleInput(`sha256:${"7".repeat(64)}`));
  const registry = new InMemoryProviderRegistry();
  registeredReferenceProvider(registry);
  registry.registerEvaluator({
    evaluatorId: "reference-evidence-evaluator.v1",
    evidenceContractId: "reference-evidence.v1",
    conditionIds: ["reference-value-observed"],
    evaluateCondition: () => ({ conditionId: "different-condition", disposition: "SATISFIED" })
  });
  const { orchestrator } = await executionHarness(bundle, registry);
  await orchestrator.submit(request(bundle.bundleDigest, "wrong-condition-result"));
  const result = await orchestrator.processNext();
  assert.equal(result.status, "QUARANTINED");
  assert.equal(result.closure.obligationDisposition.kind, "NOT_OBSERVABLE");
  assert.deepEqual(result.closure.obligationDisposition.reasons.map((reason) => reason.conditionId), [
    "reference-value-observed"
  ]);
});

test("recovery never dispatches an attempt beyond the configured maximum", async () => {
  const { compileCapabilityBundle, InMemoryProviderRegistry } = await platform();
  const bundle = compileCapabilityBundle(bundleInput(`sha256:${"6".repeat(64)}`));
  const registry = new InMemoryProviderRegistry();
  let invocations = 0;
  registeredReferenceProvider(registry, async (input) => {
    invocations += 1;
    return input;
  });
  registeredReferenceEvaluator(registry);
  let current = "2026-08-09T00:00:00.000Z";
  const clock = { now: () => current };
  const { orchestrator, executions } = await executionHarness(
    bundle,
    registry,
    { maximumAttempts: 1, claimLeaseMilliseconds: 1_000, claimHeartbeatMilliseconds: 250 },
    clock
  );
  const admitted = await orchestrator.submit(request(bundle.bundleDigest, "recovered-attempt-limit"));
  const claim = executions.claimNext({
    claimedAt: current,
    leaseExpiresAt: "2026-08-09T00:00:01.000Z"
  });
  assert.ok(claim);
  const { version: _version, ...state } = admitted.record;
  executions.commit({
    executionId: admitted.record.request.executionId,
    expectedVersion: admitted.record.version,
    committedAt: current,
    fencingToken: claim.fencingToken,
    next: { ...state, status: "RUNNING", attempt: 1 },
    events: []
  });
  current = "2026-08-09T00:00:02.000Z";
  const recovered = await orchestrator.processNext();
  assert.equal(recovered.status, "QUARANTINED");
  assert.equal(recovered.attempt, 1);
  assert.equal(recovered.reasonCode, "attempt-limit-reached-before-dispatch");
  assert.equal(invocations, 0);
  assert.equal(executions.events("recovered-attempt-limit").some((event) => event.kind === "DISPATCHED"), false);
});

test("long-running work renews its lease and receives fencing/idempotency context", async () => {
  const { compileCapabilityBundle, InMemoryProviderRegistry } = await platform();
  const bundle = compileCapabilityBundle(bundleInput(`sha256:${"5".repeat(64)}`));
  const registry = new InMemoryProviderRegistry();
  let executionContext = null;
  registeredReferenceProvider(registry, async (input, context) => {
    executionContext = context;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return input;
  });
  registeredReferenceEvaluator(registry);
  const clock = { now: () => new Date().toISOString() };
  const { orchestrator } = await executionHarness(
    bundle,
    registry,
    { maximumAttempts: 1, claimLeaseMilliseconds: 100, claimHeartbeatMilliseconds: 20 },
    clock
  );
  await orchestrator.submit(request(bundle.bundleDigest, "lease-heartbeat"));
  const completed = await orchestrator.processNext();
  assert.equal(completed.status, "COMPLETED");
  assert.equal(executionContext.idempotencyKey, "tenant-a-reference-001");
  assert.equal(executionContext.attempt, 1);
  assert.match(executionContext.fencingToken, /^lease-heartbeat\.fence-/);
});

test("repository commits state and ordered testimony under version and lease fencing", async () => {
  const { InMemoryExecutionRepository } = await platform();
  const repository = new InMemoryExecutionRepository();
  const executionRequest = request(`sha256:${"9".repeat(64)}`, "atomic-transition");
  const event = (kind, attempt, occurredAt) => ({
    eventType: "sda-orchestration-event.v1",
    executionId: executionRequest.executionId,
    rootExecutionId: executionRequest.executionId,
    tenantId: executionRequest.tenant.tenantId,
    bundleDigest: executionRequest.bundleDigest,
    scenarioId: executionRequest.scenarioId,
    attempt,
    kind,
    occurredAt
  });
  const admitted = repository.admit(
    executionRequest,
    event("REQUEST_ADMITTED", 0, "2026-08-09T00:00:00.000Z")
  ).record;
  assert.throws(() => {
    admitted.request.bundleDigest = `sha256:${"0".repeat(64)}`;
  }, TypeError);
  const claim = repository.claimNext({
    claimedAt: "2026-08-09T00:00:01.000Z",
    leaseExpiresAt: "2026-08-09T00:01:01.000Z"
  });
  assert.ok(claim);
  const { version: _version, ...admittedState } = admitted;
  const completed = repository.commit({
    executionId: executionRequest.executionId,
    expectedVersion: admitted.version,
    committedAt: "2026-08-09T00:00:02.000Z",
    fencingToken: claim.fencingToken,
    releaseClaim: true,
    next: { ...admittedState, status: "COMPLETED", attempt: 1 },
    events: [
      event("ATTEMPT_STARTED", 1, "2026-08-09T00:00:02.000Z"),
      event("ATTEMPT_COMPLETED", 1, "2026-08-09T00:00:03.000Z")
    ]
  });
  assert.equal(completed.version, 2);
  assert.deepEqual(repository.events(executionRequest.executionId).map((item) => item.eventId), [
    "atomic-transition.event-1",
    "atomic-transition.event-2",
    "atomic-transition.event-3"
  ]);
  assert.throws(() => repository.events(executionRequest.executionId).push({}), TypeError);
  assert.throws(() => repository.commit({
    executionId: executionRequest.executionId,
    expectedVersion: admitted.version,
    committedAt: "2026-08-09T00:00:04.000Z",
    fencingToken: claim.fencingToken,
    next: admittedState,
    events: [event("ATTEMPT_FAILED", 1, "2026-08-09T00:00:04.000Z")]
  }), /version conflict/);
  assert.equal(repository.get(executionRequest.executionId).status, "COMPLETED");
  assert.equal(repository.events(executionRequest.executionId).length, 3);

  const fencedRepository = new InMemoryExecutionRepository();
  const fencedRequest = request(`sha256:${"8".repeat(64)}`, "fenced-transition");
  const fencedEvent = {
    ...event("REQUEST_ADMITTED", 0, "2026-08-09T00:00:00.000Z"),
    executionId: fencedRequest.executionId,
    rootExecutionId: fencedRequest.executionId,
    bundleDigest: fencedRequest.bundleDigest
  };
  const fencedRecord = fencedRepository.admit(fencedRequest, fencedEvent).record;
  const fencedClaim = fencedRepository.claimNext({
    claimedAt: "2026-08-09T00:00:01.000Z",
    leaseExpiresAt: "2026-08-09T00:00:02.000Z"
  });
  assert.ok(fencedClaim);
  const { version: _fencedVersion, ...fencedState } = fencedRecord;
  const fencedTransition = {
    executionId: fencedRequest.executionId,
    expectedVersion: fencedRecord.version,
    next: { ...fencedState, status: "COMPLETED", attempt: 1 },
    events: []
  };
  assert.throws(() => fencedRepository.commit({
    ...fencedTransition,
    committedAt: "2026-08-09T00:00:01.250Z",
    fencingToken: fencedClaim.fencingToken,
    next: {
      ...fencedTransition.next,
      request: { ...fencedTransition.next.request, bundleDigest: `sha256:${"1".repeat(64)}` }
    }
  }), /immutable execution request/);
  assert.throws(() => fencedRepository.commit({
    ...fencedTransition,
    committedAt: "2026-08-09T00:00:01.250Z",
    fencingToken: fencedClaim.fencingToken,
    events: [{
      ...fencedEvent,
      executionId: "another-execution",
      rootExecutionId: "another-execution",
      kind: "ATTEMPT_COMPLETED",
      attempt: 1
    }]
  }), /executionId does not match immutable execution lineage/);
  assert.throws(() => fencedRepository.appendTestimony(fencedRequest.executionId, {
    ...fencedEvent,
    rootExecutionId: "another-root"
  }), /rootExecutionId does not match immutable execution lineage/);
  assert.throws(() => fencedRepository.commit({
    ...fencedTransition,
    committedAt: "2026-08-09T00:00:01.500Z",
    fencingToken: "stale-fence"
  }), /stale or missing fencing token/);
  assert.throws(() => fencedRepository.commit({
    ...fencedTransition,
    committedAt: "2026-08-09T00:00:02.000Z",
    fencingToken: fencedClaim.fencingToken
  }), /claim lease has expired/);
  assert.equal(fencedRepository.get(fencedRequest.executionId).version, 1);
  const recoveredClaim = fencedRepository.claimNext({
    claimedAt: "2026-08-09T00:00:03.000Z",
    leaseExpiresAt: "2026-08-09T00:01:03.000Z"
  });
  assert.ok(recoveredClaim);
  assert.notEqual(recoveredClaim.fencingToken, fencedClaim.fencingToken);
});
