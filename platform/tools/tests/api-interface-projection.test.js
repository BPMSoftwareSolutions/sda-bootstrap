"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");
const API_CONTRACTS_ROOT = path.join(REPO_ROOT, "capabilities", "sda-tooling", "api-interface-projection", "contracts");
const KERNEL_SCHEMAS_ROOT = path.join(REPO_ROOT, "kernel", "schemas");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const [loader, runner, provider, model, interfaceKind, canonical] = await Promise.all([
    importDist("adapters", "api-interface-projection", "node-api-interface-authority-loader.js"),
    importDist("interfaces", "api-interface-projection", "run.js"),
    importDist("capabilities", "api-interface-projection", "derive-api-operation-graph", "provider.js"),
    importDist("capabilities", "api-interface-projection", "derive-api-operation-graph", "model.js"),
    importDist("model", "interface-kind.js"),
    importDist("enterprise", "control-plane", "canonical-json.js")
  ]);
  return { ...loader, ...runner, ...provider, ...model, ...interfaceKind, ...canonical };
}

test("API capability, interface, input, and public DTO authority is closed and admitted", async () => {
  const { loadApiOperationGraphFixture, sha256Digest } = await modules();
  const apiAdmission = new AjvSchemaAdmission(API_CONTRACTS_ROOT);
  const kernelAdmission = new AjvSchemaAdmission(KERNEL_SCHEMAS_ROOT);
  assert.deepEqual(apiAdmission.unresolvedSchemaFiles(), []);
  const input = loadApiOperationGraphFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "interfaces/sda-api/projection-fixture.json"
  });
  const inputAdmission = apiAdmission.validate(input, "derive-api-operation-graph-input.schema.json");
  assert.equal(inputAdmission.valid, true, JSON.stringify(inputAdmission.errors));
  for (const authority of input.interfaceAuthorities) {
    const result = apiAdmission.validate(authority, "sda-api-interface-authority.schema.json");
    assert.equal(result.valid, true, `${authority.apiId}: ${JSON.stringify(result.errors)}`);
  }
  for (const capability of input.capabilities) {
    const result = kernelAdmission.validate(capability, "capability.v3.schema.json");
    assert.equal(result.valid, true, `${capability.capabilityId}: ${JSON.stringify(result.errors)}`);
  }
  for (const contract of input.contracts) {
    assert.equal(contract.schemaDigest, sha256Digest(contract.schema), contract.contractId);
    assert.equal(contract.schema.additionalProperties, false, contract.contractId);
    assert.ok(contract.schema.$id.endsWith(`/${contract.contractId}.schema.json`), contract.contractId);
  }
});

test("canonical api vocabulary admits legacy http only through explicit normalization", async () => {
  const { canonicalizeInterfaceKind } = await modules();
  const admission = new AjvSchemaAdmission(KERNEL_SCHEMAS_ROOT);
  const v1Api = admission.validate({ interfaceId: "surface", kind: "api", scenarioIds: ["scenario"] }, "interface-binding.schema.json");
  assert.equal(v1Api.valid, false, "interface-binding.v1 must remain frozen");
  for (const kind of ["api", "http"]) {
    const result = admission.validate({ interfaceId: "surface", kind, scenarioIds: ["scenario"] }, "interface-binding.v2.schema.json");
    assert.equal(result.valid, true, `${kind}: ${JSON.stringify(result.errors)}`);
  }
  assert.equal(canonicalizeInterfaceKind("api"), "api");
  assert.equal(canonicalizeInterfaceKind("http"), "api");
});

test("realization and execution authority close through one deterministic target-neutral graph", async () => {
  const { canonicalizeJson, runConfiguredApiOperationGraph } = await modules();
  const run = await runConfiguredApiOperationGraph({
    repositoryRoot: REPO_ROOT,
    executionId: "api-graph-one"
  });
  assert.equal(run.closure.kernelDisposition, "completed");
  assert.equal(run.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(run.closure.experienceDisposition, "REALIZED");
  const graph = run.closure.evidence;
  assert.ok(graph);
  assert.equal(graph.graphDigest, "sha256:485b15c62b03983f6000ef1055e32b86b1a4fa8fba6d740c2be24e6726a7e2ec");
  assert.equal(graph.apis.length, 2);
  assert.equal(graph.apis.flatMap((api) => api.operations).length, 8);
  assert.equal(graph.contracts.length, 13);
  for (const operation of graph.apis.flatMap((api) => api.operations)) {
    for (const lineage of [
      "x-sda-capability-id",
      "x-sda-capability-digest",
      "x-sda-scenario-id",
      "x-sda-input-contract-id",
      "x-sda-result-contract-id",
      "x-sda-obligation-id",
      "x-sda-experience-id",
      "x-sda-interface-authority-digest"
    ]) assert.equal(typeof operation[lineage], "string", `${operation.operationId}:${lineage}`);
  }
  assert.equal(canonicalizeJson(graph).includes("openapi"), false);
  const admission = new AjvSchemaAdmission(API_CONTRACTS_ROOT);
  const result = admission.validate(graph, "api-operation-graph-evidence.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("permuting registry-like compiler inputs produces byte-identical operation graphs", async () => {
  const {
    canonicalizeJson,
    loadApiOperationGraphFixture,
    runApiOperationGraph
  } = await modules();
  const input = loadApiOperationGraphFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "interfaces/sda-api/projection-fixture.json"
  });
  const permuted = {
    ...input,
    interfaceAuthorities: [...input.interfaceAuthorities].reverse(),
    capabilities: [...input.capabilities].reverse(),
    contracts: [...input.contracts].reverse()
  };
  const first = await runApiOperationGraph({ repositoryRoot: REPO_ROOT, input, executionId: "api-graph-ordered" });
  const second = await runApiOperationGraph({ repositoryRoot: REPO_ROOT, input: permuted, executionId: "api-graph-permuted" });
  assert.ok(first.closure.evidence);
  assert.ok(second.closure.evidence);
  assert.equal(canonicalizeJson(first.closure.evidence), canonicalizeJson(second.closure.evidence));
});

test("the public execution submission cannot spoof trusted platform context", () => {
  const admission = new AjvSchemaAdmission(API_CONTRACTS_ROOT);
  const valid = {
    submissionType: "sda-execution-submission.v1",
    capabilityId: "capability-a",
    scenarioId: "scenario-a",
    release: { releaseSelector: "current" },
    input: { value: "caller-intent" }
  };
  assert.equal(admission.validate(valid, "execution-submission.schema.json").valid, true);
  for (const member of [
    "executionId",
    "tenant",
    "subject",
    "environment",
    "region",
    "requestedAt",
    "traceparent",
    "dataClassification",
    "idempotencyKey"
  ]) {
    const result = admission.validate({ ...valid, [member]: "caller-value" }, "execution-submission.schema.json");
    assert.equal(result.valid, false, member);
  }
});

test("graph derivation rejects stale contracts, ambiguous routes, and false scenario lineage", async () => {
  const {
    DeriveApiOperationGraphProvider,
    digestWithoutField,
    loadApiOperationGraphFixture
  } = await modules();
  const input = loadApiOperationGraphFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "interfaces/sda-api/projection-fixture.json"
  });
  const provider = new DeriveApiOperationGraphProvider();

  const stale = structuredClone(input);
  stale.contracts[0].schema.title = "substituted after catalog admission";
  await assert.rejects(() => provider.execute(stale), /failed schema digest verification/);

  const ambiguous = structuredClone(input);
  const executionAuthority = ambiguous.interfaceAuthorities.find((authority) => authority.apiId === "sda-execution-api");
  executionAuthority.operations[2].path = executionAuthority.operations[1].path;
  executionAuthority.authorityDigest = digestWithoutField(executionAuthority, "authorityDigest");
  await assert.rejects(() => provider.execute(ambiguous), /route .* is ambiguous/);

  const falseLineage = structuredClone(input);
  falseLineage.interfaceAuthorities[0].operations[0].source.experienceId = "substituted-experience";
  falseLineage.interfaceAuthorities[0].authorityDigest = digestWithoutField(falseLineage.interfaceAuthorities[0], "authorityDigest");
  await assert.rejects(() => provider.execute(falseLineage), /does not match its source scenario lineage/);
});

test("configured API authority references cannot traverse outside the repository", async () => {
  const { loadApiOperationGraphFixture } = await modules();
  assert.throws(() => loadApiOperationGraphFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "../scenario-driven-architecture/interfaces/sda-api/projection-fixture.json"
  }), /escapes the repository root/);
});
