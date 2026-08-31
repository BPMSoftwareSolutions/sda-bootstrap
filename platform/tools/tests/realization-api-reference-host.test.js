"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");
const API_SCHEMAS = path.join(REPO_ROOT, "capabilities", "sda-tooling", "api-interface-projection", "contracts");
const PLANNING_SCHEMAS = path.join(REPO_ROOT, "capabilities", "sda-tooling", "realization-planning", "contracts");
const FIXTURE_ROOT = path.join(REPO_ROOT, "examples", "generic-capability", "realization");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const values = await Promise.all([
    importDist("enterprise", "control-plane", "canonical-json.js"),
    importDist("enterprise", "adapters", "in-memory-realization-plan-repository.js"),
    importDist("enterprise", "interfaces", "http", "realization-api-application.js"),
    importDist("enterprise", "interfaces", "http", "realization-api-model.js"),
    importDist("enterprise", "interfaces", "http", "node-api-reference-host.js"),
    importDist("capabilities", "api-interface-projection", "derive-api-operation-graph", "model.js"),
    importDist("capabilities", "realization-planning", "construct-deterministic-realization-plan", "model.js"),
    importDist("adapters", "api-interface-projection", "node-api-interface-authority-loader.js"),
    importDist("adapters", "realization-planning", "in-memory-immutable-authority-registry.js"),
    importDist("interfaces", "realization-planning", "run-registered.js")
  ]);
  return Object.assign({}, ...values);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fixture() {
  return readJson(path.join(FIXTURE_ROOT, "fixture.json"));
}

async function registriesFromFixture(value) {
  const { InMemoryImmutableAuthorityRegistry, digestCapabilityGraph, digestWithoutField } = await modules();
  const registry = (authorityId, digest, aliases, authority, verify) =>
    new InMemoryImmutableAuthorityRegistry([{ authorityId, digest, aliases, value: authority }], verify);
  return {
    intents: registry(value.intentAuthority.intentId, value.intentAuthority.authorityDigest, value.aliases.intent,
      value.intentAuthority, (authority, digest, authorityId) => authority.intentId === authorityId &&
        authority.authorityDigest === digest && digestWithoutField(authority, "authorityDigest") === digest),
    registrations: registry(value.capabilityRegistration.registrationId, value.capabilityRegistration.registrationDigest,
      value.aliases.capabilityRegistration, value.capabilityRegistration,
      (authority, digest, authorityId) => authority.registrationId === authorityId &&
        authority.registrationDigest === digest && digestWithoutField(authority, "registrationDigest") === digest),
    policies: registry(value.realizationPolicy.policyId, value.realizationPolicy.policyDigest, value.aliases.realizationPolicy,
      value.realizationPolicy, (authority, digest, authorityId) => authority.policyId === authorityId &&
        authority.policyDigest === digest && digestWithoutField(authority, "policyDigest") === digest),
    environmentProfiles: registry(value.environmentProfiles[0].profileId, value.environmentProfiles[0].profileDigest,
      value.aliases.environmentProfile, value.environmentProfiles[0],
      (authority, digest, authorityId) => authority.profileId === authorityId &&
        authority.profileDigest === digest && digestWithoutField(authority, "profileDigest") === digest),
    capabilityGraphs: registry(value.capabilityGraph.capabilityId, value.capabilityGraph.graphDigest,
      value.aliases.capabilityGraph, value.capabilityGraph,
      (authority, digest, authorityId) => authority.capabilityId === authorityId &&
        authority.graphDigest === digest && digestCapabilityGraph(authority.entries) === digest),
    providerCatalogs: registry(value.providerCatalog.catalogId, value.providerCatalog.catalogDigest,
      value.aliases.providerCatalog, value.providerCatalog,
      (authority, digest, authorityId) => authority.catalogId === authorityId &&
        authority.catalogDigest === digest && digestWithoutField(authority, "catalogDigest") === digest),
    planningSnapshots: registry(value.planningSnapshot.snapshotId, value.planningSnapshot.snapshotDigest,
      value.aliases.planningSnapshot, value.planningSnapshot,
      (authority, digest, authorityId) => authority.snapshotId === authorityId &&
        authority.snapshotDigest === digest && digestWithoutField(authority, "snapshotDigest") === digest)
  };
}

function principal(tenantId, scopes, overrides = {}) {
  return Object.freeze({
    tokenId: `${tenantId}-token-id`,
    issuer: "https://identity.example.test",
    audiences: ["sda-public-api"],
    tenantId,
    subjectId: `${tenantId}-subject`,
    authenticationMethod: "oauth2",
    scopes,
    ...overrides
  });
}

async function harness() {
  const {
    InMemoryRealizationPlanRepository,
    RealizationApiApplication,
    RegistryBackedRealizationRequestRejectedError,
    loadNodeRealizationApiReferenceHostProfile,
    runRegisteredRealizationPlanning,
    startNodeApiReferenceHost
  } = await modules();
  const value = fixture();
  const registries = await registriesFromFixture(value);
  const lifecycle = readJson(path.join(FIXTURE_ROOT, "lifecycle-fixture.json"));
  const profile = loadNodeRealizationApiReferenceHostProfile({ repositoryRoot: REPO_ROOT });
  const plans = new InMemoryRealizationPlanRepository();
  let planSequence = 0;
  let requestSequence = 0;
  const identities = {
    nextPlanId: () => `realization-plan-${String(++planSequence).padStart(4, "0")}`,
    nextRequestId: () => `realization-request-${String(++requestSequence).padStart(4, "0")}`
  };
  const planner = {
    plannerId: "scenario-hosted-registered-realization-planner",
    plannerDigest: `sha256:${"c".repeat(64)}`,
    plan: async (request) => {
      const run = await runRegisteredRealizationPlanning({
        repositoryRoot: REPO_ROOT,
        request,
        registries,
        executionId: `api-${request.requestId}`
      });
      assert.equal(run.closure.kernelDisposition, "completed");
      assert.ok(run.closure.evidence);
      return run.closure.evidence;
    }
  };
  const selections = {
    resolverId: "reference-realization-authority-selector",
    resolverDigest: `sha256:${"d".repeat(64)}`,
    selectSubmission: async () => ({
      capabilityRelease: structuredClone(value.request.capabilityRelease),
      planningSnapshot: structuredClone(value.request.planningSnapshot)
    }),
    selectRegistrationRead: async (registrationId) => registrationId === value.capabilityRegistration.registrationId
      ? { registrationSelector: "current", releaseSelector: "current" }
      : null
  };
  const availabilityReader = {
    readerId: "reference-capability-availability-reader",
    readerDigest: `sha256:${"e".repeat(64)}`,
    read: async (registrationId, registrationDigest) =>
      registrationId === value.capabilityRegistration.registrationId &&
      registrationDigest === value.capabilityRegistration.registrationDigest
        ? structuredClone(lifecycle.availability)
        : null
  };
  const requestAdmission = {
    contractDigest: "sha256:b9fd5557b87a2a5894b96ded0ad01532b9ec2e914e426f3a34548a913218ff8e",
    admit: async (request) => {
      const admission = new AjvSchemaAdmission(PLANNING_SCHEMAS)
        .validate(request, "registry-backed-realization-plan-request.schema.json");
      if (!admission.valid) throw new RegistryBackedRealizationRequestRejectedError(admission.errors);
    }
  };
  const application = new RealizationApiApplication(
    planner,
    registries.registrations,
    selections,
    availabilityReader,
    plans,
    identities,
    requestAdmission,
    profile
  );
  const fullScopes = [
    "sda.realization.plan.submit",
    "sda.realization.plan.read",
    "sda.registration.read",
    "sda.registration.availability.read"
  ];
  const tokens = new Map([
    ["tenant-a-full", principal("tenant-a", fullScopes)],
    ["tenant-b-full", principal("tenant-b", fullScopes)],
    ["tenant-a-plan-read", principal("tenant-a", ["sda.realization.plan.read"])],
    ["wrong-issuer", principal("tenant-a", fullScopes, { issuer: "https://untrusted.example.test" })]
  ]);
  const handle = await startNodeApiReferenceHost({
    repositoryRoot: REPO_ROOT,
    profile,
    application,
    accessTokens: { verify: async (token) => tokens.get(token) ?? null },
    identities,
    clock: { now: () => "2026-08-11T12:00:00.000Z" }
  });
  return { application, handle, plans, profile, value };
}

async function request(origin, pathname, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  let body = options.rawBody;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }
  const response = await fetch(`${origin}${pathname}`, {
    method: options.method ?? "GET",
    headers,
    ...(body !== undefined ? { body } : {})
  });
  const text = await response.text();
  return { response, value: text.length > 0 ? JSON.parse(text) : null };
}

function trustedContextAbsent(value) {
  const serialized = JSON.stringify(value);
  return ![
    "tenantId", "subjectId", "authenticationMethod", "workloadIdentity", "requestedAt", "traceparent",
    "idempotencyKey", "planningSnapshot", "capabilityRelease", "providerBindings", "policyDecision", "projection"
  ].some((member) => serialized.includes(`\"${member}\"`));
}

function publicSubmission(value) {
  return {
    submissionType: "sda-realization-plan-submission.v1",
    intent: { intentId: value.intentAuthority.intentId, selector: "current" },
    registration: { registrationId: value.capabilityRegistration.registrationId, selector: "current" },
    realizationPolicy: { policyId: value.realizationPolicy.policyId, selector: "current" },
    targets: [{
      targetId: value.request.targets[0].targetId,
      environmentProfileId: value.environmentProfiles[0].profileId,
      selector: "simulation"
    }]
  };
}

test("realization host profile is closed, content addressed, and pins every trusted binding", async () => {
  const {
    digestWithoutField,
    RealizationApiApplication,
    loadNodeRealizationApiReferenceHostProfile
  } = await modules();
  const admission = new AjvSchemaAdmission(API_SCHEMAS);
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  const profile = loadNodeRealizationApiReferenceHostProfile({ repositoryRoot: REPO_ROOT });
  assert.equal(profile.hostProfileDigest, digestWithoutField(profile, "hostProfileDigest"));
  const result = admission.validate(profile, "node-realization-api-reference-host-profile.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(profile.operationGraphDigest, "sha256:485b15c62b03983f6000ef1055e32b86b1a4fa8fba6d740c2be24e6726a7e2ec");
  assert.equal(profile.openApiDocumentDigest, "sha256:e2a9cef49c98a59dac7cea9e23ca3c4ba0cc9f7538d313097d3a3bcc05be48c8");
  const catalog = readJson(path.join(REPO_ROOT, "capabilities", "sda-api", "catalog.json"));
  const realization = catalog.capabilities.find((candidate) => candidate.capabilityId === "realization-resource-api");
  assert.equal(realization.status, "REFERENCE_IMPLEMENTATION");
  assert.ok(fs.existsSync(path.join(REPO_ROOT, realization.hostProfileRef)));
  assert.ok(fs.existsSync(path.join(REPO_ROOT, realization.implementationRef)));
  assert.equal(realization.wireEvidenceContractId, "realization-api-wire-conformance-evidence.v1");
  assert.throws(() => new RealizationApiApplication(
    { plannerId: "substituted-planner", plannerDigest: profile.bindings.plannerDigest },
    {},
    { resolverId: profile.bindings.selectorResolverId, resolverDigest: profile.bindings.selectorResolverDigest },
    { readerId: profile.bindings.availabilityReaderId, readerDigest: profile.bindings.availabilityReaderDigest },
    {}, {},
    { contractDigest: profile.bindings.registryBackedRequestContractDigest },
    profile
  ), /planner binding does not match/);
  assert.throws(() => loadNodeRealizationApiReferenceHostProfile({
    repositoryRoot: REPO_ROOT,
    profileRef: "../scenario-driven-architecture/interfaces/sda-api/realization-host-profile.json"
  }), /escapes the repository root/);
});

test("real TCP realization API preserves trusted selection, tenancy, idempotency, and read-only projections", async () => {
  const { digestWithoutField } = await modules();
  const admission = new AjvSchemaAdmission(API_SCHEMAS);
  const state = await harness();
  const cases = [];
  const observe = (caseId, operationId, expectedStatus, result, responseContractId) => {
    const filename = responseContractId === "api-problem.v1"
      ? "api-problem.schema.json"
      : `${responseContractId.replace(/\.v[1-9][0-9]*$/, "")}.schema.json`;
    const contract = admission.validate(result.value, filename);
    const entry = {
      caseId,
      operationId,
      expectedStatus,
      actualStatus: result.response.status,
      responseContractId,
      contractAdmitted: contract.valid,
      trustedContextAbsent: trustedContextAbsent(result.value),
      disposition: expectedStatus === result.response.status && contract.valid && trustedContextAbsent(result.value)
        ? "CONFORMING"
        : "NONCONFORMING"
    };
    cases.push(entry);
    assert.equal(entry.disposition, "CONFORMING", `${caseId}: ${JSON.stringify(contract.errors)}`);
    return result.value;
  };
  const submission = publicSubmission(state.value);
  const registrationId = state.value.capabilityRegistration.registrationId;
  try {
    let result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", body: {}, headers: { "idempotency-key": "wire-case-0001" }
    });
    observe("authentication-required", "submit-realization-plan", 401, result, "api-problem.v1");
    assert.match(result.response.headers.get("www-authenticate"), /^Bearer realm=/);

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "wrong-issuer", body: {}, headers: { "idempotency-key": "wire-case-0002" }
    });
    observe("untrusted-token-issuer", "submit-realization-plan", 401, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-plan-read", body: {}, headers: { "idempotency-key": "wire-case-0003" }
    });
    observe("insufficient-submit-scope", "submit-realization-plan", 403, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", rawBody: "plain text",
      headers: { "content-type": "text/plain", "idempotency-key": "wire-case-0004" }
    });
    observe("unsupported-media-type", "submit-realization-plan", 415, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", rawBody: "{}",
      headers: { "content-type": "application/json", "content-encoding": "gzip", "idempotency-key": "wire-case-0005" }
    });
    observe("unsupported-content-encoding", "submit-realization-plan", 415, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full",
      rawBody: JSON.stringify(submission).replace('"intentId"', '"intentId":"substituted","intentId"'),
      headers: { "content-type": "application/json", "idempotency-key": "wire-case-0006" }
    });
    observe("duplicate-json-member", "submit-realization-plan", 400, result, "api-problem.v1");
    assert.equal(result.value.reasonCode, "JSON_INVALID");

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", rawBody: new Uint8Array([0xc3, 0x28]),
      headers: { "content-type": "application/json", "idempotency-key": "wire-case-0007" }
    });
    observe("invalid-utf8-body", "submit-realization-plan", 400, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", body: { ...submission, planningSnapshot: { selector: "spoofed" } },
      headers: { "idempotency-key": "wire-case-0008" }
    });
    observe("trusted-selection-spoof-rejected", "submit-realization-plan", 400, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", rawBody: "x".repeat(state.profile.limits.maximumBodyBytes + 1),
      headers: { "content-type": "application/json", "idempotency-key": "wire-case-0009" }
    });
    observe("request-body-limited", "submit-realization-plan", 413, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", body: submission,
      headers: {
        "idempotency-key": "wire-case-happy-0001",
        traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
      }
    });
    const planned = observe("realization-plan-created", "submit-realization-plan", 201, result, "realization-plan-resource.v1");
    assert.equal(result.response.headers.get("location"), planned.links.self);
    const stored = state.plans.get(planned.planId);
    assert.equal(stored.tenantId, "tenant-a");
    assert.equal(stored.plan.capabilityRelease.releaseId, state.value.capabilityRegistration.releases[0].releaseId);
    assert.equal(stored.plan.targetResolutions[0].environmentProfileId, state.value.environmentProfiles[0].profileId);

    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", body: submission,
      headers: { "idempotency-key": "wire-case-happy-0001" }
    });
    const duplicate = observe("realization-plan-deduplicated", "submit-realization-plan", 201, result, "realization-plan-resource.v1");
    assert.equal(duplicate.planId, planned.planId);
    assert.equal(duplicate.planDigest, planned.planDigest);

    const changed = structuredClone(submission);
    changed.targets[0].selector = "current";
    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", body: changed,
      headers: { "idempotency-key": "wire-case-happy-0001" }
    });
    observe("idempotency-conflict", "submit-realization-plan", 409, result, "api-problem.v1");

    result = await request(state.handle.origin, `/v1/realization-plans/${planned.planId}`, { token: "tenant-b-full" });
    observe("cross-tenant-plan-not-found", "inspect-realization-plan", 404, result, "api-problem.v1");

    result = await request(state.handle.origin, `/v1/realization-plans/${planned.planId}`, { token: "tenant-a-full" });
    observe("realization-plan-inspected", "inspect-realization-plan", 200, result, "realization-plan-resource.v1");

    result = await request(state.handle.origin, `/v1/realization-plans/${planned.planId}?unknown=1`, { token: "tenant-a-full" });
    observe("unknown-query-rejected", "inspect-realization-plan", 400, result, "api-problem.v1");

    const blocked = structuredClone(submission);
    blocked.intent.selector = "missing";
    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", body: blocked,
      headers: { "idempotency-key": "wire-case-blocked-0001" }
    });
    observe("governed-selector-rejection", "submit-realization-plan", 400, result, "api-problem.v1");
    assert.equal(result.value.reasonCode, "REALIZATION_PLAN_BLOCKED");
    assert.equal(JSON.stringify(result.value).includes("INTENT_SELECTOR_NOT_FOUND"), false);

    const internallyUnadmitted = structuredClone(submission);
    internallyUnadmitted.intent.selector = "a".repeat(129);
    result = await request(state.handle.origin, "/v1/realization-plans", {
      method: "POST", token: "tenant-a-full", body: internallyUnadmitted,
      headers: { "idempotency-key": "wire-case-internal-admission-0001" }
    });
    observe("internal-request-contract-rejection", "submit-realization-plan", 400, result, "api-problem.v1");
    assert.equal(result.value.reasonCode, "REALIZATION_REQUEST_NOT_ADMITTED");

    result = await request(state.handle.origin, `/v1/capability-registrations/${registrationId}`, {
      token: "tenant-a-plan-read"
    });
    observe("registration-scope-separated", "read-capability-registration", 403, result, "api-problem.v1");

    result = await request(state.handle.origin, `/v1/capability-registrations/${registrationId}`, {
      token: "tenant-a-full"
    });
    const registration = observe("registration-read", "read-capability-registration", 200, result,
      "capability-registration-resource.v1");
    assert.equal(registration.state, "ACTIVE");
    assert.equal("ownerId" in registration, false);

    result = await request(state.handle.origin, `/v1/capability-registrations/${registrationId}/availability`, {
      token: "tenant-a-full"
    });
    const availability = observe("cold-availability-read", "read-capability-availability", 200, result,
      "capability-availability-resource.v1");
    assert.equal(availability.state, "COLD");
    assert.equal(availability.eligibleForRehydration, true);
    assert.equal("computedAt" in availability, false);

    result = await request(state.handle.origin, "/v1/capability-registrations/missing-registration", {
      token: "tenant-a-full"
    });
    observe("registration-not-found", "read-capability-registration", 404, result, "api-problem.v1");

    result = await request(state.handle.origin, `/v1/realization-plans/${planned.planId}`, {
      token: "tenant-a-full", headers: { traceparent: "00-invalid" }
    });
    observe("trace-context-rejected", "inspect-realization-plan", 400, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/realization-plans", { method: "PUT", token: "tenant-a-full" });
    observe("method-not-allowed", "unmatched-operation", 405, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/not-a-route", { token: "tenant-a-full" });
    observe("route-not-found", "unmatched-operation", 404, result, "api-problem.v1");

    const withoutDigest = {
      evidenceType: "sda-realization-api-wire-conformance-evidence.v1",
      hostProfileDigest: state.handle.profileDigest,
      operationGraphDigest: state.handle.operationGraphDigest,
      openApiDocumentDigest: state.handle.openApiDocumentDigest,
      cases,
      totals: { cases: cases.length, conforming: cases.filter((entry) => entry.disposition === "CONFORMING").length },
      disposition: cases.every((entry) => entry.disposition === "CONFORMING") ? "CONFORMING" : "NONCONFORMING"
    };
    const wireEvidence = { ...withoutDigest, evidenceDigest: digestWithoutField(withoutDigest, "evidenceDigest") };
    assert.equal(wireEvidence.disposition, "CONFORMING");
    assert.equal(wireEvidence.totals.cases, 24);
    const wireAdmission = admission.validate(wireEvidence, "realization-api-wire-conformance-evidence.schema.json");
    assert.equal(wireAdmission.valid, true, JSON.stringify(wireAdmission.errors, null, 2));
  } finally {
    await state.handle.close();
  }
});
