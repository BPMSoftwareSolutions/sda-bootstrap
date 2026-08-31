"use strict";

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DIST_ROOT = path.join(REPO_ROOT, "artifacts", "tools", "dist");
const API_CONTRACTS_ROOT = path.join(REPO_ROOT, "capabilities", "sda-tooling", "api-interface-projection", "contracts");

function importDist(...segments) {
  return import(pathToFileURL(path.join(DIST_ROOT, ...segments)).href);
}

async function modules() {
  const [loader, runner, provider, model, graphModel, canonical] = await Promise.all([
    importDist("adapters", "api-interface-projection", "node-api-interface-authority-loader.js"),
    importDist("interfaces", "api-interface-projection", "run.js"),
    importDist("capabilities", "api-interface-projection", "project-openapi-description", "provider.js"),
    importDist("capabilities", "api-interface-projection", "project-openapi-description", "model.js"),
    importDist("capabilities", "api-interface-projection", "derive-api-operation-graph", "model.js"),
    importDist("enterprise", "control-plane", "canonical-json.js")
  ]);
  return { ...loader, ...runner, ...provider, ...model, ...graphModel, ...canonical };
}

function projectedOperations(document) {
  return Object.entries(document.paths).flatMap(([route, pathItem]) =>
    Object.entries(pathItem).map(([method, operation]) => ({ route, method, operation }))
  );
}

test("configured bounded OpenAPI profile, input, and evidence are closed and content addressed", async () => {
  const {
    loadOpenApiProjectionFixture,
    runConfiguredOpenApiProjection,
    sha256Digest,
    digestWithoutField
  } = await modules();
  const admission = new AjvSchemaAdmission(API_CONTRACTS_ROOT);
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  const configured = loadOpenApiProjectionFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "interfaces/sda-api/openapi-projection-fixture.json"
  });
  assert.equal(configured.profile.profileDigest, digestWithoutField(configured.profile, "profileDigest"));
  const profileAdmission = admission.validate(configured.profile, "openapi-projection-profile.schema.json");
  assert.equal(profileAdmission.valid, true, JSON.stringify(profileAdmission.errors));

  const run = await runConfiguredOpenApiProjection({
    repositoryRoot: REPO_ROOT,
    executionId: "openapi-profile-conformance"
  });
  assert.equal(run.operationGraphRun.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(run.closure.kernelDisposition, "completed");
  assert.equal(run.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(run.closure.experienceDisposition, "REALIZED");
  const evidence = run.closure.evidence;
  assert.ok(evidence);
  assert.equal(evidence.operationGraphDigest, "sha256:485b15c62b03983f6000ef1055e32b86b1a4fa8fba6d740c2be24e6726a7e2ec");
  assert.equal(evidence.documentDigest, "sha256:e2a9cef49c98a59dac7cea9e23ca3c4ba0cc9f7538d313097d3a3bcc05be48c8");
  assert.equal(evidence.evidenceDigest, "sha256:63de34546076b3bad33ff1724f750620079e7e7d127d4e992fa39ec71160893c");
  assert.equal(evidence.documentDigest, sha256Digest(evidence.document));
  assert.equal(evidence.evidenceDigest, digestWithoutField(evidence, "evidenceDigest"));
  const evidenceAdmission = admission.validate(evidence, "openapi-projection-evidence.schema.json");
  assert.equal(evidenceAdmission.valid, true, JSON.stringify(evidenceAdmission.errors, null, 2));
});

test("every graph operation, response, scope, contract, and lineage field survives projection", async () => {
  const { loadOpenApiProjectionFixture, runConfiguredOpenApiProjection } = await modules();
  const configured = loadOpenApiProjectionFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "interfaces/sda-api/openapi-projection-fixture.json"
  });
  const run = await runConfiguredOpenApiProjection({ repositoryRoot: REPO_ROOT });
  const evidence = run.closure.evidence;
  const graph = run.operationGraphRun.closure.evidence;
  assert.ok(evidence);
  assert.ok(graph);
  const document = evidence.document;
  assert.equal(document.openapi, "3.1.2");
  assert.equal(document.jsonSchemaDialect, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(Object.hasOwn(document, "servers"), false, "deployment endpoints remain host configuration");
  assert.deepEqual(evidence.equivalence, {
    disposition: "EQUIVALENT",
    operationCount: 8,
    responseCount: 54,
    scopeCount: 8,
    contractCount: 13,
    operationMappings: evidence.equivalence.operationMappings,
    contractMappings: evidence.equivalence.contractMappings
  });

  const projected = new Map(projectedOperations(document).map((entry) => [entry.operation.operationId, entry]));
  const lineageFields = [
    "x-sda-capability-id", "x-sda-capability-digest", "x-sda-scenario-id",
    "x-sda-input-contract-id", "x-sda-result-contract-id", "x-sda-obligation-id",
    "x-sda-experience-id", "x-sda-interface-authority-digest"
  ];
  for (const api of graph.apis) {
    for (const graphOperation of api.operations) {
      const entry = projected.get(graphOperation.operationId);
      assert.ok(entry, graphOperation.operationId);
      assert.equal(entry.route, graphOperation.path);
      assert.equal(entry.method, graphOperation.method.toLowerCase());
      assert.deepEqual(Object.keys(entry.operation.responses).map(Number), graphOperation.responses.map((response) => response.statusCode));
      assert.deepEqual(entry.operation.security, [{ SdaOAuth: graphOperation.requiredScopes }]);
      for (const field of lineageFields) assert.equal(entry.operation[field], graphOperation[field], `${graphOperation.operationId}:${field}`);
      for (const response of graphOperation.responses) {
        const projectedResponse = entry.operation.responses[String(response.statusCode)];
        assert.equal(projectedResponse["x-sda-contract-id"], response.contract.contractId);
        assert.equal(projectedResponse["x-sda-contract-digest"], response.contract.contractDigest);
        const expectedMedia = response.contract.contractId === "api-problem.v1"
          ? "application/problem+json"
          : "application/json";
        assert.deepEqual(Object.keys(projectedResponse.content), [expectedMedia]);
      }
    }
  }

  const contractById = new Map(configured.operationGraphInput.contracts.map((contract) => [contract.contractId, contract]));
  for (const mapping of evidence.equivalence.contractMappings) {
    const source = structuredClone(contractById.get(mapping.contractId).schema);
    delete source.$schema;
    delete source.$id;
    const component = structuredClone(document.components.schemas[mapping.componentName]);
    assert.equal(component["x-sda-contract-id"], mapping.contractId);
    assert.equal(component["x-sda-schema-digest"], mapping.schemaDigest);
    delete component["x-sda-contract-id"];
    delete component["x-sda-schema-id"];
    delete component["x-sda-schema-digest"];
    assert.deepEqual(component, source, mapping.contractId);
  }

  const events = projected.get("read-execution-events").operation;
  assert.deepEqual(events.parameters.find((parameter) => parameter.name === "limit").schema, {
    type: "integer", minimum: 1, maximum: 200
  });
  const submission = projected.get("submit-governed-execution").operation;
  assert.deepEqual(submission.parameters.find((parameter) => parameter.name === "Idempotency-Key").schema, { type: "string" });
  assert.equal(submission.requestBody["x-sda-contract-id"], "execution-submission.v1");
});

test("registry order does not change canonical OpenAPI document or equivalence evidence", async () => {
  const {
    canonicalizeJson,
    loadOpenApiProjectionFixture,
    runApiOperationGraph,
    runOpenApiProjection
  } = await modules();
  const configured = loadOpenApiProjectionFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "interfaces/sda-api/openapi-projection-fixture.json"
  });
  const graphRun = await runApiOperationGraph({
    repositoryRoot: REPO_ROOT,
    input: configured.operationGraphInput,
    executionId: "openapi-determinism-graph"
  });
  assert.ok(graphRun.closure.evidence);
  const baseInput = {
    inputType: "sda-openapi-description-projection-input.v1",
    operationGraph: graphRun.closure.evidence,
    contracts: configured.operationGraphInput.contracts,
    profile: configured.profile
  };
  const first = await runOpenApiProjection({ repositoryRoot: REPO_ROOT, input: baseInput, executionId: "openapi-ordered" });
  const second = await runOpenApiProjection({
    repositoryRoot: REPO_ROOT,
    input: { ...baseInput, contracts: [...baseInput.contracts].reverse() },
    executionId: "openapi-reversed"
  });
  assert.ok(first.closure.evidence);
  assert.ok(second.closure.evidence);
  assert.equal(canonicalizeJson(first.closure.evidence), canonicalizeJson(second.closure.evidence));
});

test("projection rejects stale profiles, unsupported schema keywords, graph drift, and profile limit overflow", async () => {
  const {
    ProjectOpenApiDescriptionProvider,
    digestWithoutField,
    loadOpenApiProjectionFixture,
    runApiOperationGraph,
    sha256Digest
  } = await modules();
  const configured = loadOpenApiProjectionFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "interfaces/sda-api/openapi-projection-fixture.json"
  });
  const graphRun = await runApiOperationGraph({ repositoryRoot: REPO_ROOT, input: configured.operationGraphInput });
  assert.ok(graphRun.closure.evidence);
  const base = {
    inputType: "sda-openapi-description-projection-input.v1",
    operationGraph: graphRun.closure.evidence,
    contracts: configured.operationGraphInput.contracts,
    profile: configured.profile
  };
  const provider = new ProjectOpenApiDescriptionProvider();

  const staleProfile = structuredClone(base);
  staleProfile.profile.title = "Unaddressed profile mutation";
  await assert.rejects(() => provider.execute(staleProfile), /profile .* failed digest verification/);

  const unsupported = structuredClone(base);
  const contract = unsupported.contracts.find((candidate) => candidate.contractId === "execution-submission.v1");
  contract.schema.properties.capabilityId.format = "opaque-extension";
  contract.schemaDigest = sha256Digest(contract.schema);
  const descriptor = unsupported.operationGraph.contracts.find((candidate) => candidate.contractId === contract.contractId);
  descriptor.schemaDigest = contract.schemaDigest;
  for (const api of unsupported.operationGraph.apis) {
    for (const operation of api.operations) {
      if (operation.body?.contractId === contract.contractId) operation.body.contractDigest = contract.schemaDigest;
      for (const response of operation.responses) {
        if (response.contract.contractId === contract.contractId) response.contract.contractDigest = contract.schemaDigest;
      }
    }
  }
  unsupported.operationGraph.graphDigest = digestWithoutField(unsupported.operationGraph, "graphDigest");
  await assert.rejects(() => provider.execute(unsupported), /unsupported schema keyword 'format'/);

  const drift = structuredClone(base);
  drift.operationGraph.apis[0].operations[0].responses[0].contract.contractDigest =
    "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  drift.operationGraph.graphDigest = digestWithoutField(drift.operationGraph, "graphDigest");
  await assert.rejects(() => provider.execute(drift), /inconsistent graph contract binding/);

  const overflow = structuredClone(base);
  overflow.profile.limits.maximumOperations = 1;
  overflow.profile.profileDigest = digestWithoutField(overflow.profile, "profileDigest");
  await assert.rejects(() => provider.execute(overflow), /exceeds profile .* limits/);
});

test("configured OpenAPI fixture references cannot traverse outside the repository", async () => {
  const { loadOpenApiProjectionFixture } = await modules();
  assert.throws(() => loadOpenApiProjectionFixture({
    repositoryRoot: REPO_ROOT,
    fixtureRef: "../scenario-driven-architecture/interfaces/sda-api/openapi-projection-fixture.json"
  }), /escapes the repository root/);
});
