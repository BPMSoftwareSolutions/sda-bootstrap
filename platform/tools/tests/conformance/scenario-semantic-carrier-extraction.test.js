import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

import { createNodeMechanicRegistry } from "../../../languages/typescript/runtimes/node/node-mechanic-registry-loader.mjs";
import {
  canonicalJsonDigest,
  canonicalGraphBytes,
  evaluateScenarioSemanticCarrierExtraction,
  invokeScenarioSemanticCarrierExtraction,
  sha256,
} from "../../../languages/typescript/runtimes/node/semantic-carrier-extractor-provider.mjs";
import { evaluateScenarioSemanticCarrier } from "../../../languages/typescript/runtimes/node/semantic-carrier-validator/index.mjs";

const repositoryRoot = new URL("../../../", import.meta.url);
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;
const providerAuthorityRef = "capabilities/sda-platform/bind-scenario-semantic-carrier-extraction/scenario-semantic-carrier-extractor.authority.json";
const fixtureRef = "capabilities/sda-platform/verify-scenario-semantic-carrier-extraction-conformance/fixtures/valid-extractor.carrier.ts";

function source(reference = fixtureRef) {
  return fs.readFileSync(new URL(reference, repositoryRoot), "utf8");
}

function request(reference = fixtureRef, sourceId = "valid-extractor.carrier.ts") {
  const bytes = source(reference);
  const validatorReceipt = evaluateScenarioSemanticCarrier({
    contractId: "semantic-carrier-validation-request.v1",
    payload: { source: bytes, sourceId },
  });
  return {
    contractId: "semantic-carrier-extraction-request.v1",
    payload: { source: bytes, sourceId, validatorReceipt },
  };
}

function configuration() {
  return {
    providerAuthorityRef,
    providerAuthorityDigest: sha256(fs.readFileSync(new URL(providerAuthorityRef, repositoryRoot))),
  };
}

test("exact validator receipt produces one canonical graph and establishes blackout", () => {
  const first = evaluateScenarioSemanticCarrierExtraction(request());
  const second = evaluateScenarioSemanticCarrierExtraction(request());
  assert.deepEqual(first, second);
  assert.equal(first.disposition, "EXTRACTED");
  assert.equal(first.graph.schemaVersion, "canonical-carrier-graph.v1");
  assert.equal(first.graphDigest, "sha256:5f2becb4433da43141aaa2ac68d18af5d2c3d44e0a818131991cd42436e8eef9");
  assert.equal(first.graphDigest, sha256(Buffer.from(canonicalGraphBytes(first.graph), "utf8")));
  assert.equal(first.carrierBlackout, true);
  assert.equal(Object.hasOwn(first, "carrier"), false);
  assert.deepEqual(first.findings, []);
  const { receiptDigest, ...material } = first;
  assert.equal(receiptDigest, canonicalJsonDigest(material));
});

test("managed carrier v3 produces one management-preserving graph and establishes blackout", () => {
  const managedFixture = "capabilities/sda-platform/verify-scenario-semantic-carrier-extraction-conformance/fixtures/valid-managed-extractor.carrier.ts";
  const first = evaluateScenarioSemanticCarrierExtraction(request(managedFixture, "valid-managed-extractor.carrier.ts"));
  const second = evaluateScenarioSemanticCarrierExtraction(request(managedFixture, "valid-managed-extractor.carrier.ts"));
  assert.deepEqual(first, second);
  assert.equal(first.disposition, "EXTRACTED");
  assert.equal(first.graph.schemaVersion, "canonical-managed-carrier-graph.v1");
  assert.equal(first.graph.carrierSchemaVersion, "scenario-semantic-carrier.v3");
  assert.equal(first.graph.semanticGraph.schemaVersion, "canonical-carrier-graph.v1");
  assert.equal(first.graph.management.profile, "sidefx-managed-capability.v1");
  assert.equal(first.graph.source.sourceId, "valid-managed-extractor.carrier.ts");
  assert.equal(first.graphDigest, sha256(Buffer.from(canonicalGraphBytes(first.graph), "utf8")));
  assert.equal(first.carrierBlackout, true);
  assert.equal(Object.hasOwn(first, "carrier"), false);
  assert.deepEqual(first.findings, []);
});

test("request and both result variants satisfy the admitted contracts", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const requestSchema = JSON.parse(fs.readFileSync(new URL("capabilities/sda-platform/bind-scenario-semantic-carrier-extraction/contracts/semantic-carrier-extraction-request.v1.schema.json", repositoryRoot), "utf8"));
  const resultSchema = JSON.parse(fs.readFileSync(new URL("capabilities/sda-platform/bind-scenario-semantic-carrier-extraction/contracts/semantic-carrier-extraction-result.v1.schema.json", repositoryRoot), "utf8"));
  const validateRequest = ajv.compile(requestSchema);
  const validateResult = ajv.compile(resultSchema);
  const admitted = request();
  assert.equal(validateRequest(admitted), true, JSON.stringify(validateRequest.errors));
  assert.equal(validateResult(evaluateScenarioSemanticCarrierExtraction(admitted)), true, JSON.stringify(validateResult.errors));
  admitted.payload.source = `${admitted.payload.source}\n`;
  assert.equal(validateResult(evaluateScenarioSemanticCarrierExtraction(admitted)), true, JSON.stringify(validateResult.errors));
});

test("changed carrier bytes fail before graph creation", () => {
  const input = request();
  input.payload.source = `${input.payload.source}\n`;
  const result = evaluateScenarioSemanticCarrierExtraction(input);
  assert.equal(result.disposition, "EXTRACTION_HELD");
  assert.equal(result.graph, null);
  assert.ok(result.findings.some(({ code }) => code === "VALIDATOR_CARRIER_BINDING_DIVERGED"));
});

test("altered validator receipt fails before graph creation", () => {
  const input = request();
  input.payload.validatorReceipt.sourceId = "other.carrier.ts";
  const result = evaluateScenarioSemanticCarrierExtraction(input);
  assert.equal(result.disposition, "EXTRACTION_HELD");
  assert.equal(result.graph, null);
  assert.ok(result.findings.some(({ code }) => code === "VALIDATOR_RECEIPT_DIGEST_MISMATCH"));
  assert.ok(result.findings.some(({ code }) => code === "VALIDATOR_CARRIER_BINDING_DIVERGED"));
});

test("provider invocation and registry reach exact admitted provider", async () => {
  const expected = evaluateScenarioSemanticCarrierExtraction(request());
  assert.deepEqual(invokeScenarioSemanticCarrierExtraction(configuration(), request(), repositoryRoot), expected);
  const registry = createNodeMechanicRegistry({
    bindingUrl: repositoryRoot,
    invokeBinding: async () => { throw new Error("unexpected nested invocation"); },
  });
  const port = registry.eventPorts.get("sda-scenario-semantic-carrier-extraction-port.v1");
  assert.equal(typeof port, "function");
  assert.deepEqual(await port({ configuration: configuration() }, request(), { rootExecutionId: "extractor-provider-conformance" }), expected);
});

test("provider authority, registration, catalog, and conformance identities are closed", () => {
  const provider = JSON.parse(fs.readFileSync(new URL(providerAuthorityRef, repositoryRoot), "utf8"));
  const { authorityDigest, ...authorityMaterial } = provider;
  assert.equal(authorityDigest, canonicalJsonDigest(authorityMaterial));
  const registrationRef = "kernel/semantic-authority/consumer/node-mechanic-registrations/scenario-semantic-carrier-extraction.registration.authority.json";
  const registration = JSON.parse(fs.readFileSync(new URL(registrationRef, repositoryRoot), "utf8"));
  const { authorityDigest: registrationDigest, ...registrationMaterial } = registration;
  assert.equal(registrationDigest, canonicalJsonDigest(registrationMaterial));
  const catalog = JSON.parse(fs.readFileSync(new URL("kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json", repositoryRoot), "utf8"));
  const catalogEntry = catalog.capabilities.find(({ capabilityId }) => capabilityId === "sda-scenario-semantic-carrier-extraction-port.v1");
  assert.ok(catalogEntry);
  assert.equal(catalogEntry.providerAuthorityDigest, authorityDigest);
  const conformanceRef = "capabilities/sda-platform/verify-scenario-semantic-carrier-extraction-conformance/conformance/scenario-semantic-carrier-extraction-provider-conformance.v1.json";
  const conformance = JSON.parse(fs.readFileSync(new URL(conformanceRef, repositoryRoot), "utf8"));
  const { receiptDigest, ...receiptMaterial } = conformance;
  assert.equal(receiptDigest, canonicalJsonDigest(receiptMaterial));
  assert.equal(catalogEntry.conformanceDigest, receiptDigest);
  assert.equal(conformance.disposition, "SDA_SCENARIO_SEMANTIC_CARRIER_EXTRACTION_PROVIDER_CONFORMANT");
  assert.deepEqual(conformance.findings, []);
});
