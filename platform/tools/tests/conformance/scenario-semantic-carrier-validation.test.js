import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { createNodeMechanicRegistry } from "../../../languages/typescript/runtimes/node/node-mechanic-registry-loader.mjs";
import {
  canonicalJsonDigest,
  evaluateScenarioSemanticCarrier,
  invokeScenarioSemanticCarrierValidation,
  sha256,
} from "../../../languages/typescript/runtimes/node/semantic-carrier-validator/index.mjs";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const repositoryRoot = new URL("../../../", import.meta.url);
const fixtureRoot = new URL(
  "capabilities/sda-platform/verify-scenario-semantic-carrier-validation-conformance/fixtures/",
  repositoryRoot,
);
const providerAuthorityRef = "capabilities/sda-platform/bind-scenario-semantic-carrier-validation/scenario-semantic-carrier-validator.authority.json";
const requestContractRef = "capabilities/sda-platform/bind-scenario-semantic-carrier-validation/contracts/semantic-carrier-validation-request.v1.schema.json";
const resultContractRef = "capabilities/sda-platform/bind-scenario-semantic-carrier-validation/contracts/semantic-carrier-validation-result.v1.schema.json";
const providerAuthorityContractRef = "capabilities/sda-platform/bind-scenario-semantic-carrier-validation/contracts/scenario-semantic-carrier-validator.authority.schema.json";
const conformanceContractRef = "capabilities/sda-platform/verify-scenario-semantic-carrier-validation-conformance/contracts/scenario-semantic-carrier-validation-provider-conformance.v1.schema.json";
const fixtureManifestContractRef = "capabilities/sda-platform/verify-scenario-semantic-carrier-validation-conformance/fixtures/fixture-manifest.authority.schema.json";
const fixtureManifestRef = "capabilities/sda-platform/verify-scenario-semantic-carrier-validation-conformance/fixtures/fixture-manifest.authority.json";
const conformanceReceiptRef = "capabilities/sda-platform/verify-scenario-semantic-carrier-validation-conformance/conformance/scenario-semantic-carrier-validation-provider-conformance.v1.json";

function readRepositoryJson(reference) {
  return JSON.parse(fs.readFileSync(new URL(reference, repositoryRoot), "utf8"));
}

function repositoryFileDigest(reference) {
  return sha256(fs.readFileSync(new URL(reference, repositoryRoot)));
}

function withoutProperty(document, property) {
  return Object.fromEntries(Object.entries(document).filter(([key]) => key !== property));
}

function assertAuthorityDigest(reference) {
  const authority = readRepositoryJson(reference);
  assert.equal(
    authority.authorityDigest,
    canonicalJsonDigest(withoutProperty(authority, "authorityDigest")),
    `${reference} authorityDigest`,
  );
  return authority;
}

function source(name) {
  return fs.readFileSync(new URL(name, fixtureRoot), "utf8");
}

function request(name, sourceId = name) {
  return {
    contractId: "semantic-carrier-validation-request.v1",
    payload: { source: source(name), sourceId },
  };
}

function configuration() {
  const provider = readRepositoryJson(providerAuthorityRef);
  return {
    grammarAuthorityRef: provider.grammarAuthority.grammarRef,
    grammarAuthorityDigest: provider.grammarAuthority.grammarDigest,
    providerAuthorityRef,
    providerAuthorityDigest: repositoryFileDigest(providerAuthorityRef),
  };
}

function compileSchema(reference) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  return ajv.compile(readRepositoryJson(reference));
}

test("conforming literal carrier returns exact admitted carrier and no findings", () => {
  const input = request("valid-validator.carrier.ts");
  const first = evaluateScenarioSemanticCarrier(input);
  const second = evaluateScenarioSemanticCarrier(input);
  assert.deepEqual(first, second);
  assert.equal(first.disposition, "CONFORMANT");
  assert.equal(first.sourceDigest, sha256(Buffer.from(input.payload.source, "utf8")));
  assert.equal(first.grammarVersion, "scenario-semantic-carrier.v2");
  assert.equal(first.carrier.capability.id, "validate-semantic-carrier");
  assert.deepEqual(first.findings, []);
  const { receiptDigest, ...material } = first;
  assert.equal(receiptDigest, canonicalJsonDigest(material));
});

test("conforming managed carrier v3 returns the complete management authority without execution", () => {
  const input = request("valid-managed-validator.carrier.ts");
  const first = evaluateScenarioSemanticCarrier(input);
  const second = evaluateScenarioSemanticCarrier(input);
  assert.deepEqual(first, second);
  assert.equal(first.disposition, "CONFORMANT");
  assert.equal(first.grammarVersion, "scenario-semantic-carrier.v3");
  assert.equal(first.carrier.capability.id, "greet-by-name");
  assert.equal(first.carrier.management.profile, "sidefx-managed-capability.v1");
  assert.equal(first.carrier.management.realizations.length, 4);
  assert.deepEqual(first.findings, []);
  const { receiptDigest, ...material } = first;
  assert.equal(receiptDigest, canonicalJsonDigest(material));
});

test("managed carrier v3 rejects absolute local-folder dependencies", () => {
  const input = request("valid-managed-validator.carrier.ts");
  input.payload.source = input.payload.source.replace(
    'sourcePath: "input.payload.name"',
    'sourcePath: "C:\\\\lab\\\\media\\\\input.wav"',
  );
  const result = evaluateScenarioSemanticCarrier(input);
  assert.equal(result.disposition, "CARRIER_NOT_CONFORMANT");
  assert.ok(result.findings.some(({ code }) => code === "LOCAL_FOLDER_DEPENDENCY_NOT_ADMITTED"));
});

test("hidden executable meaning fails closed before carrier admission", () => {
  const result = evaluateScenarioSemanticCarrier(request("hidden-meaning.carrier.ts"));
  assert.equal(result.disposition, "CARRIER_NOT_CONFORMANT");
  assert.equal(result.carrier, null);
  assert.ok(result.findings.some(({ code }) => code === "HIDDEN_EXECUTABLE_MEANING"));
  assert.deepEqual(result.findings, [...result.findings].sort((left, right) =>
    `${left.path}|${left.code}|${left.message}`.localeCompare(`${right.path}|${right.code}|${right.message}`)));
});

test("unresolved semantic identity fails closed with exact finding", () => {
  const result = evaluateScenarioSemanticCarrier(request("unresolved-identity.carrier.ts"));
  assert.equal(result.disposition, "CARRIER_NOT_CONFORMANT");
  assert.equal(result.carrier, null);
  assert.ok(result.findings.some(({ code }) => code === "UNRESOLVED_CONTRACT_REFERENCE"));
});

test("input and source identity admission reject ambiguity", () => {
  assert.throws(() => evaluateScenarioSemanticCarrier({}), /SEMANTIC_CARRIER_VALIDATION_INPUT_NOT_ADMITTED/);
  assert.throws(
    () => evaluateScenarioSemanticCarrier({
      contractId: "semantic-carrier-validation-request.v1",
      payload: { source: source("valid-validator.carrier.ts"), sourceId: "../escape.ts" },
    }),
    /SEMANTIC_CARRIER_VALIDATION_INPUT_NOT_ADMITTED/,
  );
});

test("provider invocation binds exact admitted grammar and provider authority bytes", () => {
  const admitted = configuration();
  assert.equal(
    invokeScenarioSemanticCarrierValidation(admitted, request("valid-validator.carrier.ts"), repositoryRoot).disposition,
    "CONFORMANT",
  );
  assert.throws(
    () => invokeScenarioSemanticCarrierValidation(
      { ...admitted, grammarAuthorityDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      request("valid-validator.carrier.ts"),
      repositoryRoot,
    ),
    /SEMANTIC_CARRIER_GRAMMAR_AUTHORITY_DIGEST_MISMATCH/,
  );
});

test("real registry invocation reaches the admitted provider", async () => {
  const registry = createNodeMechanicRegistry({
    bindingUrl: repositoryRoot,
    invokeBinding: async () => { throw new Error("unexpected nested invocation"); },
  });
  const port = registry.eventPorts.get("sda-scenario-semantic-carrier-validation-port.v1");
  assert.equal(typeof port, "function");
  const input = request("valid-validator.carrier.ts");
  assert.deepEqual(
    await port({ configuration: configuration() }, input, { rootExecutionId: "semantic-carrier-validation-conformance" }),
    evaluateScenarioSemanticCarrier(input),
  );
});

test("request, result, provider authority, fixture manifest, and conformance contracts admit exact artifacts", () => {
  const validateRequest = compileSchema(requestContractRef);
  const validateResult = compileSchema(resultContractRef);
  const validateProvider = compileSchema(providerAuthorityContractRef);
  const validateFixtureManifest = compileSchema(fixtureManifestContractRef);
  const validateConformance = compileSchema(conformanceContractRef);
  const input = request("valid-validator.carrier.ts");
  assert.equal(validateRequest(input), true, JSON.stringify(validateRequest.errors));
  assert.equal(validateResult(evaluateScenarioSemanticCarrier(input)), true, JSON.stringify(validateResult.errors));
  assert.equal(validateResult(evaluateScenarioSemanticCarrier(request("valid-managed-validator.carrier.ts"))), true, JSON.stringify(validateResult.errors));
  assert.equal(validateResult(evaluateScenarioSemanticCarrier(request("hidden-meaning.carrier.ts"))), true, JSON.stringify(validateResult.errors));
  assert.equal(validateProvider(readRepositoryJson(providerAuthorityRef)), true, JSON.stringify(validateProvider.errors));
  assert.equal(validateFixtureManifest(readRepositoryJson(fixtureManifestRef)), true, JSON.stringify(validateFixtureManifest.errors));
  assert.equal(validateConformance(readRepositoryJson(conformanceReceiptRef)), true, JSON.stringify(validateConformance.errors));
});

test("provider, grammar, registry, runtime, fixture, and catalog identities are closed", () => {
  const provider = assertAuthorityDigest(providerAuthorityRef);
  assert.equal(provider.grammarAuthority.grammarDigest, repositoryFileDigest(provider.grammarAuthority.grammarRef));
  assert.equal(provider.managedGrammarAuthority.grammarDigest, repositoryFileDigest(provider.managedGrammarAuthority.grammarRef));
  assert.equal(provider.providerObservation.registryBindingDigest, repositoryFileDigest(provider.providerObservation.registryBindingRef));
  assert.equal(provider.runtimeDependencies.packageLockDigest, repositoryFileDigest(provider.runtimeDependencies.packageLockRef));
  for (const sourceBinding of provider.providerObservation.providerSourceSet) {
    assert.equal(sourceBinding.sourceDigest, repositoryFileDigest(sourceBinding.sourceRef), sourceBinding.sourceRef);
  }

  const registry = readRepositoryJson("kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json");
  const registrationEntry = registry.eventPorts.find(({ platformCapabilityId }) =>
    platformCapabilityId === "sda-scenario-semantic-carrier-validation-port.v1");
  assert.ok(registrationEntry);
  assert.equal(registrationEntry.registrationAuthorityDigest, repositoryFileDigest(registrationEntry.registrationAuthorityRef));
  const registration = assertAuthorityDigest(registrationEntry.registrationAuthorityRef);
  for (const property of ["platformCapabilityId", "kind", "providerModule", "providerExport", "invocation"]) {
    assert.equal(registrationEntry[property], registration[property], property);
  }

  const fixtureManifest = readRepositoryJson(fixtureManifestRef);
  const records = [];
  for (const artifact of fixtureManifest.artifacts) {
    assert.equal(artifact.sourceDigest, repositoryFileDigest(`${fixtureManifest.fixtureRoot}/${artifact.path}`), artifact.path);
    records.push(Buffer.concat([
      Buffer.from(artifact.path, "utf8"),
      Buffer.from([0]),
      Buffer.from(artifact.sourceDigest, "utf8"),
      Buffer.from("\n", "utf8"),
    ]));
  }
  records.sort(Buffer.compare);
  assert.equal(fixtureManifest.fixtureSetDigest, `sha256:${crypto.createHash("sha256").update(Buffer.concat(records)).digest("hex")}`);

  const conformance = readRepositoryJson(conformanceReceiptRef);
  assert.equal(conformance.fixtureManifestDigest, repositoryFileDigest(fixtureManifestRef));
  assert.equal(conformance.fixtureSetDigest, fixtureManifest.fixtureSetDigest);
  assert.equal(conformance.authorityDigests.provider, provider.authorityDigest);
  assert.equal(conformance.authorityDigests.grammar, provider.grammarAuthority.grammarDigest);
  assert.equal(conformance.authorityDigests.managedGrammar, provider.managedGrammarAuthority.grammarDigest);
  assert.equal(conformance.receiptDigest, canonicalJsonDigest(withoutProperty(conformance, "receiptDigest")));
  assert.equal(conformance.disposition, "SDA_SCENARIO_SEMANTIC_CARRIER_VALIDATION_PROVIDER_CONFORMANT");
  assert.equal(conformance.partitions.length, 9);
  assert.ok(conformance.partitions.every(({ disposition, evidenceDigests, reason }) =>
    disposition === "SATISFIED" && evidenceDigests.length > 0 && reason === null));
  assert.deepEqual(conformance.findings, []);

  const catalog = readRepositoryJson("kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json");
  const catalogEntry = catalog.capabilities.find(({ capabilityId, projectionTarget }) =>
    capabilityId === "sda-scenario-semantic-carrier-validation-port.v1" && projectionTarget === "node");
  assert.ok(catalogEntry);
  assert.equal(catalogEntry.providerAuthorityRef, providerAuthorityRef);
  assert.equal(catalogEntry.providerAuthorityDigest, provider.authorityDigest);
  assert.equal(catalogEntry.conformanceDigest, conformance.receiptDigest);
});
