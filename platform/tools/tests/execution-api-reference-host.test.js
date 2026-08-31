"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");
const API_SCHEMAS = path.join(REPO_ROOT, "capabilities", "sda-tooling", "api-interface-projection", "contracts");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const values = await Promise.all([
    importDist("enterprise", "control-plane", "canonical-json.js"),
    importDist("enterprise", "control-plane", "capability-bundle.js"),
    importDist("enterprise", "adapters", "in-memory-bundle-registry.js"),
    importDist("enterprise", "adapters", "in-memory-execution-repository.js"),
    importDist("enterprise", "adapters", "in-memory-provider-registry.js"),
    importDist("enterprise", "adapters", "allow-all-invocation-policy.js"),
    importDist("enterprise", "data-plane", "durable-execution-orchestrator.js"),
    importDist("enterprise", "interfaces", "http", "execution-api-application.js"),
    importDist("enterprise", "interfaces", "http", "node-api-reference-host.js"),
    importDist("enterprise", "interfaces", "http", "strict-json.js"),
    importDist("capabilities", "api-interface-projection", "derive-api-operation-graph", "model.js"),
    importDist("adapters", "api-interface-projection", "node-api-interface-authority-loader.js"),
    importDist("adapters", "node-scenario-kernel", "node-scenario-kernel-runner.js"),
    importDist("adapters", "contracts", "function-contract-admission.js"),
    importDist("adapters", "telemetry", "in-memory-execution-observer.js"),
    importDist("host", "tool-capability-host.js")
  ]);
  return Object.assign({}, ...values);
}

const capability = {
  capabilityType: "scenario-driven-capability.v2",
  capabilityId: "enterprise-reference-capability",
  purpose: "provide one admitted execution target for API wire conformance",
  consumer: { actor: "wire conformance client" },
  interfaces: [],
  scenarios: [{
    scenarioType: "scenario.v2",
    scenarioId: "perform-reference-work",
    input: { inputId: "reference-input", contract: { contractId: "reference-input.v1" } },
    event: {
      eventId: "reference-work-requested",
      responsibility: { responsibilityId: "perform-reference-work", statement: "produce redaction-safe reference evidence" },
      executionAuthorityId: "reference-work-authority.v1"
    },
    outcome: {
      outcomeId: "reference-work-known",
      obligation: {
        obligationId: "reference-evidence-is-present",
        statement: "reference evidence is present",
        observableConditions: [{ conditionId: "reference-value-observed", statement: "the evidence contains a value" }]
      },
      evidence: { contract: { contractId: "reference-evidence.v1" } },
      experience: {
        experienceId: "reference-work-is-visible",
        actor: "wire conformance client",
        promise: "the client can retrieve admitted redacted evidence"
      }
    }
  }]
};

function bundleInput() {
  return {
    bundleId: "enterprise-reference-bundle",
    version: "1.0.0",
    capability,
    providerBindings: {
      bindingType: "responsibility-provider-bindings.v1",
      bindings: [{
        responsibilityId: "perform-reference-work",
        providerId: "node-reference-provider.v1",
        implementationRef: "artifacts/tools/dist/tests/reference-provider.js",
        requires: ["durable-orchestration"]
      }]
    },
    observationBindings: {
      bindingType: "observation-bindings.v1",
      bindings: [{
        conditionId: "reference-value-observed",
        evaluatorId: "reference-evidence-evaluator.v1",
        evidenceContractId: "reference-evidence.v1"
      }]
    },
    authorities: [{
      authorityId: "enterprise-reference-authority",
      mediaType: "application/json",
      fact: {
        sourceRef: "capabilities/enterprise-reference/capability.json",
        digest: `sha256:${"a".repeat(64)}`,
        observedAt: "2026-08-11T12:00:00.000Z",
        value: capability
      }
    }],
    provenance: {
      sourceRevision: "0123456789abcdef",
      projectorDigest: `sha256:${"1".repeat(64)}`,
      toolchain: "node-24-typescript-5.9",
      builtAt: "2026-08-11T12:00:00.000Z",
      sbomRef: "sbom/enterprise-reference.cdx.json"
    },
    evidence: [{
      gate: "KERNEL_CONFORMANT",
      evidenceRef: "artifacts/conformance/node.json",
      digest: `sha256:${"2".repeat(64)}`
    }]
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
    homeRegion: "us-east",
    scopes,
    ...overrides
  });
}

async function harness() {
  const {
    AllowAllInvocationPolicy,
    compileCapabilityBundle,
    DurableExecutionOrchestrator,
    ExecutionApiApplication,
    FunctionContractAdmission,
    InMemoryBundleRegistry,
    InMemoryExecutionObserver,
    InMemoryExecutionRepository,
    InMemoryProviderRegistry,
    loadNodeApiReferenceHostProfile,
    NodeScenarioKernelRunner,
    startNodeApiReferenceHost,
    ToolCapabilityHost
  } = await modules();
  const bundle = compileCapabilityBundle(bundleInput());
  const bundles = new InMemoryBundleRegistry();
  bundles.register(bundle);
  const executions = new InMemoryExecutionRepository();
  const providers = new InMemoryProviderRegistry();
  providers.registerProvider({
    providerId: "node-reference-provider.v1",
    responsibilityId: "perform-reference-work",
    implementationRef: "artifacts/tools/dist/tests/reference-provider.js",
    requires: ["durable-orchestration"],
    execute: async () => ({ value: "redaction-safe-evidence", privateDetail: "must-not-cross-wire" })
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
  const clock = { now: () => "2026-08-11T12:00:00.000Z" };
  const scenarioHost = new ToolCapabilityHost(
    new NodeScenarioKernelRunner(REPO_ROOT, clock),
    contracts,
    new InMemoryExecutionObserver()
  );
  const orchestrator = new DurableExecutionOrchestrator(
    bundles,
    executions,
    providers,
    new AllowAllInvocationPolicy(),
    scenarioHost,
    { maximumAttempts: 1 },
    clock
  );
  const profile = loadNodeApiReferenceHostProfile({ repositoryRoot: REPO_ROOT });
  let executionSequence = 0;
  let requestSequence = 0;
  const identities = {
    nextExecutionId: () => `execution-${String(++executionSequence).padStart(4, "0")}`,
    nextRequestId: () => `api-request-${String(++requestSequence).padStart(4, "0")}`
  };
  const fullScopes = [
    "sda.execution.submit",
    "sda.execution.read",
    "sda.execution.events.read",
    "sda.execution.evidence.read"
  ];
  const tokens = new Map([
    ["tenant-a-full", principal("tenant-a", fullScopes)],
    ["tenant-b-full", principal("tenant-b", fullScopes)],
    ["tenant-a-read", principal("tenant-a", ["sda.execution.read"])],
    ["wrong-issuer", principal("tenant-a", fullScopes, { issuer: "https://untrusted.example.test" })]
  ]);
  const application = new ExecutionApiApplication(
    orchestrator,
    executions,
    {
      resolve: async (release, capabilityId) => {
        if (capabilityId !== capability.capabilityId) return null;
        if (release.bundleDigest === bundle.bundleDigest || release.releaseSelector === "current") return bundle.bundleDigest;
        return null;
      }
    },
    {
      projectorId: "reference-execution-evidence-redactor",
      projectorDigest: `sha256:${"e".repeat(64)}`,
      project: async (evidence) => ({
        value: evidence && typeof evidence === "object" ? evidence.value : null
      })
    },
    identities,
    {
      contractDigest: "sha256:85257ac6608c3623194dcffa48ee6c97e6784863e46a5ae2d52881c1b69a5f7b",
      admit: async (request) => {
        const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"))
          .validate(request, "execution-request.schema.json");
        if (!admission.valid) throw new Error(`Internal execution request admission failed: ${JSON.stringify(admission.errors)}`);
      }
    },
    profile
  );
  const handle = await startNodeApiReferenceHost({
    repositoryRoot: REPO_ROOT,
    profile,
    application,
    accessTokens: { verify: async (token) => tokens.get(token) ?? null },
    identities,
    clock
  });
  return { application, bundle, executions, handle, orchestrator, profile };
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
    "tenantId", "subjectId", "authenticationMethod", "workloadIdentity", "environment",
    "region", "requestedAt", "traceparent", "idempotencyKey", "privateDetail"
  ].some((member) => serialized.includes(`\"${member}\"`));
}

test("reference host profile is closed, content addressed, and pinned to admitted projections", async () => {
  const { digestWithoutField, ExecutionApiApplication, loadNodeApiReferenceHostProfile } = await modules();
  const admission = new AjvSchemaAdmission(API_SCHEMAS);
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  const profile = loadNodeApiReferenceHostProfile({ repositoryRoot: REPO_ROOT });
  assert.equal(profile.hostProfileDigest, digestWithoutField(profile, "hostProfileDigest"));
  const result = admission.validate(profile, "node-api-reference-host-profile.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(profile.operationGraphDigest, "sha256:485b15c62b03983f6000ef1055e32b86b1a4fa8fba6d740c2be24e6726a7e2ec");
  assert.equal(profile.openApiDocumentDigest, "sha256:e2a9cef49c98a59dac7cea9e23ca3c4ba0cc9f7538d313097d3a3bcc05be48c8");
  const catalog = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "capabilities", "sda-api", "catalog.json"), "utf8"));
  const execution = catalog.capabilities.find((candidate) => candidate.capabilityId === "execution-resource-api");
  assert.equal(execution.status, "REFERENCE_IMPLEMENTATION");
  assert.ok(fs.existsSync(path.join(REPO_ROOT, execution.hostProfileRef)));
  assert.ok(fs.existsSync(path.join(REPO_ROOT, execution.implementationRef)));
  assert.equal(execution.wireEvidenceContractId, "execution-api-wire-conformance-evidence.v1");
  assert.throws(() => new ExecutionApiApplication(
    {}, {}, {},
    { projectorId: "substituted-redactor", projectorDigest: `sha256:${"e".repeat(64)}` },
    {},
    { contractDigest: profile.bindings.executionRequestContractDigest },
    profile
  ), /evidence projector binding does not match/);
  assert.throws(() => loadNodeApiReferenceHostProfile({
    repositoryRoot: REPO_ROOT,
    profileRef: "../scenario-driven-architecture/interfaces/sda-api/execution-host-profile.json"
  }), /escapes the repository root/);
});

test("strict JSON admission rejects duplicate members and excessive nesting", async () => {
  const { parseStrictJson } = await modules();
  assert.deepEqual(parseStrictJson('{"outer":{"value":1},"items":[true,null]}', 4), {
    outer: { value: 1 }, items: [true, null]
  });
  assert.throws(() => parseStrictJson('{"value":1,"value":2}', 4), /Duplicate object property 'value'/);
  assert.throws(() => parseStrictJson('{"a":{"b":{"c":1}}}', 2), /nesting exceeds 2/);
});

test("real TCP execution API preserves authentication, tenancy, limits, idempotency, and redacted evidence", async () => {
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
  try {
    let result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", body: {}, headers: { "idempotency-key": "wire-case-0001" }
    });
    observe("authentication-required", "submit-governed-execution", 401, result, "api-problem.v1");
    assert.match(result.response.headers.get("www-authenticate"), /^Bearer realm=/);

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "wrong-issuer", body: {}, headers: { "idempotency-key": "wire-case-0001b" }
    });
    observe("untrusted-token-issuer", "submit-governed-execution", 401, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-read", body: {}, headers: { "idempotency-key": "wire-case-0002" }
    });
    observe("insufficient-submit-scope", "submit-governed-execution", 403, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full", rawBody: "plain text",
      headers: { "content-type": "text/plain", "idempotency-key": "wire-case-0003" }
    });
    observe("unsupported-media-type", "submit-governed-execution", 415, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full", rawBody: "{}",
      headers: {
        "content-type": "application/json", "content-encoding": "gzip", "idempotency-key": "wire-case-0003b"
      }
    });
    observe("unsupported-content-encoding", "submit-governed-execution", 415, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full",
      rawBody: '{"submissionType":"sda-execution-submission.v1","capabilityId":"enterprise-reference-capability","capabilityId":"substituted","scenarioId":"perform-reference-work","release":{"releaseSelector":"current"},"input":{}}',
      headers: { "content-type": "application/json", "idempotency-key": "wire-case-0004" }
    });
    observe("duplicate-json-member", "submit-governed-execution", 400, result, "api-problem.v1");
    assert.equal(result.value.reasonCode, "JSON_INVALID");

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full", rawBody: new Uint8Array([0xc3, 0x28]),
      headers: { "content-type": "application/json", "idempotency-key": "wire-case-0004b" }
    });
    observe("invalid-utf8-body", "submit-governed-execution", 400, result, "api-problem.v1");

    const submission = {
      submissionType: "sda-execution-submission.v1",
      capabilityId: "enterprise-reference-capability",
      scenarioId: "perform-reference-work",
      release: { releaseSelector: "current" },
      purpose: "wire-conformance",
      input: { value: "accepted" }
    };
    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full", body: { ...submission, tenantId: "spoofed" },
      headers: { "idempotency-key": "wire-case-0005" }
    });
    observe("trusted-context-spoof-rejected", "submit-governed-execution", 400, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full", rawBody: "x".repeat(state.profile.limits.maximumBodyBytes + 1),
      headers: { "content-type": "application/json", "idempotency-key": "wire-case-0006" }
    });
    observe("request-body-limited", "submit-governed-execution", 413, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full", body: submission,
      headers: {
        "idempotency-key": "wire-case-happy-0001",
        traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"
      }
    });
    const admitted = observe("execution-admitted", "submit-governed-execution", 202, result, "execution-resource.v1");
    assert.equal(result.response.headers.get("location"), admitted.links.self);
    assert.equal(admitted.duplicate, false);
    assert.equal(state.executions.get(admitted.executionId).request.tenant.tenantId, "tenant-a");
    assert.equal(state.executions.get(admitted.executionId).request.environment, state.profile.trustedDefaults.environment);
    assert.equal(state.executions.get(admitted.executionId).request.traceparent,
      "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01");

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full", body: submission,
      headers: { "idempotency-key": "wire-case-happy-0001" }
    });
    const duplicate = observe("execution-deduplicated", "submit-governed-execution", 202, result, "execution-resource.v1");
    assert.equal(duplicate.executionId, admitted.executionId);
    assert.equal(duplicate.duplicate, true);

    result = await request(state.handle.origin, "/v1/executions", {
      method: "POST", token: "tenant-a-full", body: { ...submission, input: { value: "changed" } },
      headers: { "idempotency-key": "wire-case-happy-0001" }
    });
    observe("idempotency-conflict", "submit-governed-execution", 409, result, "api-problem.v1");

    result = await request(state.handle.origin, `/v1/executions/${admitted.executionId}`, { token: "tenant-b-full" });
    observe("cross-tenant-not-found", "inspect-governed-execution", 404, result, "api-problem.v1");

    result = await request(state.handle.origin, `/v1/executions/${admitted.executionId}`, { token: "tenant-a-full" });
    observe("execution-inspected", "inspect-governed-execution", 200, result, "execution-resource.v1");

    result = await request(state.handle.origin, `/v1/executions/${admitted.executionId}/events?limit=1`, { token: "tenant-a-full" });
    const events = observe("events-sanitized", "read-execution-events", 200, result, "execution-event-collection.v1");
    assert.deepEqual(Object.keys(events.events[0]).sort(), ["attempt", "eventId", "kind", "occurredAt"]);
    assert.equal(events.nextCursor, "1");

    result = await request(state.handle.origin, `/v1/executions/${admitted.executionId}/events?limit=201`, { token: "tenant-a-full" });
    observe("event-limit-rejected", "read-execution-events", 400, result, "api-problem.v1");

    result = await request(state.handle.origin, `/v1/executions/${admitted.executionId}/events?unknown=1`, { token: "tenant-a-full" });
    observe("unknown-query-rejected", "read-execution-events", 400, result, "api-problem.v1");

    await state.orchestrator.processNext();
    result = await request(state.handle.origin, `/v1/executions/${admitted.executionId}/evidence`, { token: "tenant-a-read" });
    observe("evidence-scope-separated", "read-execution-evidence", 403, result, "api-problem.v1");

    result = await request(state.handle.origin, `/v1/executions/${admitted.executionId}/evidence`, { token: "tenant-a-full" });
    const evidence = observe("evidence-redacted", "read-execution-evidence", 200, result, "execution-evidence-resource.v1");
    assert.deepEqual(evidence.evidence, { value: "redaction-safe-evidence" });

    result = await request(state.handle.origin, `/v1/executions/${admitted.executionId}`, {
      token: "tenant-a-full", headers: { traceparent: "00-invalid" }
    });
    observe("trace-context-rejected", "inspect-governed-execution", 400, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/executions", { method: "PUT", token: "tenant-a-full" });
    observe("method-not-allowed", "unmatched-operation", 405, result, "api-problem.v1");

    result = await request(state.handle.origin, "/v1/not-a-route", { token: "tenant-a-full" });
    observe("route-not-found", "unmatched-operation", 404, result, "api-problem.v1");

    const withoutDigest = {
      evidenceType: "sda-execution-api-wire-conformance-evidence.v1",
      hostProfileDigest: state.handle.profileDigest,
      operationGraphDigest: state.handle.operationGraphDigest,
      openApiDocumentDigest: state.handle.openApiDocumentDigest,
      cases,
      totals: { cases: cases.length, conforming: cases.filter((entry) => entry.disposition === "CONFORMING").length },
      disposition: cases.every((entry) => entry.disposition === "CONFORMING") ? "CONFORMING" : "NONCONFORMING"
    };
    const wireEvidence = { ...withoutDigest, evidenceDigest: digestWithoutField(withoutDigest, "evidenceDigest") };
    assert.equal(wireEvidence.disposition, "CONFORMING");
    assert.equal(wireEvidence.totals.cases, 22);
    const wireAdmission = admission.validate(wireEvidence, "execution-api-wire-conformance-evidence.schema.json");
    assert.equal(wireAdmission.valid, true, JSON.stringify(wireAdmission.errors, null, 2));
  } finally {
    await state.handle.close();
  }
});
