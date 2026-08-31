import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createNodeMechanicRegistry } from "../../../languages/typescript/runtimes/node/node-mechanic-registry-loader.mjs";
import {
  canonicalJsonDigest,
  evaluateScenarioSemanticCarrierCompilation,
  invokeScenarioSemanticCarrierCompilationEvaluation,
  sha256,
} from "../../../languages/typescript/runtimes/node/semantic-carrier-evaluator-provider.mjs";

const repositoryRoot = new URL("../../../", import.meta.url);
const bindRoot = "capabilities/sda-platform/bind-scenario-semantic-carrier-evaluation";
const verifyRoot = "capabilities/sda-platform/verify-scenario-semantic-carrier-evaluation-conformance";
const providerAuthorityRef = `${bindRoot}/scenario-semantic-carrier-evaluator.authority.json`;
const evaluationProfileRef = `${bindRoot}/semantic-carrier-evaluation.profile.json`;
const acceptanceAuthorityRef = `${bindRoot}/semantic-carrier-evaluation.acceptance-authority.json`;
const inputContractRef = `${bindRoot}/contracts/semantic-carrier-compilation-evaluation-request.v1.schema.json`;
const resultContractRef = `${bindRoot}/contracts/semantic-carrier-compilation-evaluation-result.v1.schema.json`;

const readJson = (reference) => JSON.parse(fs.readFileSync(new URL(reference, repositoryRoot), "utf8"));
const fileDigest = (reference) => sha256(fs.readFileSync(new URL(reference, repositoryRoot)));
const profile = () => readJson(evaluationProfileRef);
const acceptance = () => readJson(acceptanceAuthorityRef);

function request(subjectKind = "ORDINARY_CAPABILITY") {
  const graphDigest = "sha256:1111111111111111111111111111111111111111111111111111111111111111";
  const validatorReceipt = {
    disposition: "CONFORMANT",
    sourceDigest: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    receiptDigest: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
  };
  const extractionReceipt = {
    disposition: "EXTRACTED",
    graphDigest,
    carrierBlackout: true,
    validatorReceiptDigest: validatorReceipt.receiptDigest,
    receiptDigest: "sha256:4444444444444444444444444444444444444444444444444444444444444444",
  };
  return {
    contractId: "semantic-carrier-compilation-evaluation-request.v1",
    payload: {
      graphDigest,
      subject: { kind: subjectKind, capabilityId: subjectKind === "EVALUATOR_REPLACEMENT" ? "evaluate-semantic-carrier-compilation-evidence" : "example-capability" },
      evaluatorCapabilityId: "evaluate-semantic-carrier-compilation-evidence",
      validatorReceipt,
      extractionReceipt,
      evidence: profile().requiredEvidenceIds.map((evidenceId, index) => ({
        evidenceId,
        graphDigest,
        producerCapabilityId: `proof-producer-${index + 1}`,
        manufacturedByEvaluator: false,
        disposition: "PASS",
        receiptDigest: `sha256:${String(index + 5).padStart(64, "0")}`,
      })),
    },
  };
}

function configuration() {
  return {
    providerAuthorityRef,
    providerAuthorityDigest: fileDigest(providerAuthorityRef),
    evaluationProfileRef,
    evaluationProfileDigest: fileDigest(evaluationProfileRef),
    acceptanceAuthorityRef,
    acceptanceAuthorityDigest: fileDigest(acceptanceAuthorityRef),
    inputContractRef,
    inputContractDigest: fileDigest(inputContractRef),
    resultContractRef,
    resultContractDigest: fileDigest(resultContractRef),
  };
}

test("complete independent evidence for an ordinary subject is review ready", () => {
  const first = evaluateScenarioSemanticCarrierCompilation(request(), profile(), acceptance());
  const second = evaluateScenarioSemanticCarrierCompilation(request(), profile(), acceptance());
  assert.deepEqual(first, second);
  assert.equal(first.disposition, "REVIEW_READY_NON_EVALUATOR_SUBJECT");
  assert.equal(first.evaluatorManufacturedEvidenceCount, 0);
  assert.deepEqual(first.findings, []);
  const { receiptDigest, ...material } = first;
  assert.equal(receiptDigest, canonicalJsonDigest(material));
});

test("evaluator replacement alone diverts to independent adjudication", () => {
  const result = evaluateScenarioSemanticCarrierCompilation(request("EVALUATOR_REPLACEMENT"), profile(), acceptance());
  assert.equal(result.disposition, "EVALUATOR_REPLACEMENT_REQUIRES_INDEPENDENT_ADJUDICATION");
  assert.deepEqual(result.findings, []);
});

test("missing, failing, divergent, or evaluator-manufactured evidence is held", () => {
  const input = request();
  input.payload.evidence.pop();
  input.payload.evidence[0].disposition = "FAIL";
  input.payload.evidence[1].graphDigest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  input.payload.evidence[2].producerCapabilityId = input.payload.evaluatorCapabilityId;
  input.payload.evidence[2].manufacturedByEvaluator = true;
  const result = evaluateScenarioSemanticCarrierCompilation(input, profile(), acceptance());
  assert.deepEqual(evaluateScenarioSemanticCarrierCompilation(input, profile(), acceptance()), result);
  assert.equal(result.disposition, "EVALUATION_HELD");
  assert.ok(result.findings.some(({ code }) => code === "REQUIRED_EVIDENCE_SET_DIVERGED"));
  assert.ok(result.findings.some(({ code }) => code === "EVIDENCE_OBLIGATION_NOT_SATISFIED"));
  assert.ok(result.findings.some(({ code }) => code === "EVIDENCE_GRAPH_LINEAGE_DIVERGED"));
  assert.ok(result.findings.some(({ code }) => code === "EVALUATOR_MANUFACTURED_EVIDENCE"));
});

test("provider invocation and real registry reach exact admitted evaluator", async () => {
  const expected = evaluateScenarioSemanticCarrierCompilation(request(), profile(), acceptance());
  assert.deepEqual(invokeScenarioSemanticCarrierCompilationEvaluation(configuration(), request(), repositoryRoot), expected);
  const registry = createNodeMechanicRegistry({
    bindingUrl: repositoryRoot,
    invokeBinding: async () => { throw new Error("unexpected nested invocation"); },
  });
  const port = registry.eventPorts.get("sda-scenario-semantic-carrier-evaluation-port.v1");
  assert.equal(typeof port, "function");
  assert.deepEqual(await port({ configuration: configuration() }, request(), { rootExecutionId: "semantic-carrier-evaluator-conformance" }), expected);
});

test("provider authority, registration, catalog, and conformance identities are closed", () => {
  const provider = readJson(providerAuthorityRef);
  const { authorityDigest, ...authorityMaterial } = provider;
  assert.equal(authorityDigest, canonicalJsonDigest(authorityMaterial));
  const registrationRef = "kernel/semantic-authority/consumer/node-mechanic-registrations/scenario-semantic-carrier-evaluation.registration.authority.json";
  const registration = readJson(registrationRef);
  const { authorityDigest: registrationDigest, ...registrationMaterial } = registration;
  assert.equal(registrationDigest, canonicalJsonDigest(registrationMaterial));
  const catalog = readJson("kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json");
  const catalogEntry = catalog.capabilities.find(({ capabilityId }) => capabilityId === "sda-scenario-semantic-carrier-evaluation-port.v1");
  assert.equal(catalogEntry.providerAuthorityDigest, authorityDigest);
  const conformance = readJson(`${verifyRoot}/conformance/scenario-semantic-carrier-evaluation-provider-conformance.v1.json`);
  const { receiptDigest, ...receiptMaterial } = conformance;
  assert.equal(receiptDigest, canonicalJsonDigest(receiptMaterial));
  assert.equal(catalogEntry.conformanceDigest, receiptDigest);
  assert.deepEqual(conformance.findings, []);
});
