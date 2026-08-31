import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function compareCodePoints(left, right) {
  const leftPoints = [...left].map((value) => value.codePointAt(0));
  const rightPoints = [...right].map((value) => value.codePointAt(0));
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index] - rightPoints[index];
  }
  return leftPoints.length - rightPoints.length;
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new TypeError("Canonical JSON number is not admitted.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(compareCodePoints).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError("Value is not representable as canonical JSON.");
}

export function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

export function canonicalJsonDigest(value) {
  return sha256(Buffer.from(canonicalJson(value), "utf8"));
}

function readBoundAuthority(reference, expectedDigest, bindingUrl) {
  if (typeof reference !== "string" || reference.length === 0 || !DIGEST_PATTERN.test(expectedDigest ?? "")) {
    throw new Error("SEMANTIC_CARRIER_EVALUATOR_AUTHORITY_BINDING_INCOMPLETE");
  }
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error("SEMANTIC_CARRIER_EVALUATOR_LOCAL_AUTHORITY_REQUIRED");
  const bytes = fs.readFileSync(fileURLToPath(url));
  if (sha256(bytes) !== expectedDigest) throw new Error(`SEMANTIC_CARRIER_EVALUATOR_AUTHORITY_DIGEST_MISMATCH:${reference}`);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
}

function normalizedAjvMessage(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.keyword}: ${error.message ?? "schema validation failed"}`)
    .sort(compareCodePoints)
    .join("; ");
}

function finding(stage, path, code, message) {
  return { stage, path, code, message };
}

function orderFindings(findings) {
  return findings.sort((left, right) => {
    for (const key of ["stage", "path", "code", "message"]) {
      const comparison = compareCodePoints(left[key], right[key]);
      if (comparison !== 0) return comparison;
    }
    return 0;
  });
}

function exactMembers(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    new Set(actual).size === actual.length && expected.every((value) => actual.includes(value));
}

export function evaluateScenarioSemanticCarrierCompilation(input, evaluationProfile, acceptanceAuthority) {
  const payload = input.payload;
  const findings = [];
  const requiredEvidenceIds = [...evaluationProfile.requiredEvidenceIds].sort(compareCodePoints);
  const observedEvidenceIds = payload.evidence.map(({ evidenceId }) => evidenceId);
  if (!exactMembers(observedEvidenceIds, requiredEvidenceIds)) {
    findings.push(finding("evidence-set", "/payload/evidence", "REQUIRED_EVIDENCE_SET_DIVERGED", "Evidence identifiers must be complete, unique, and contain no unexpected members."));
  }
  if (payload.validatorReceipt.disposition !== "CONFORMANT") {
    findings.push(finding("validator", "/payload/validatorReceipt/disposition", "VALIDATOR_RECEIPT_NOT_CONFORMANT", "The exact validator receipt must be CONFORMANT."));
  }
  if (payload.extractionReceipt.disposition !== "EXTRACTED") {
    findings.push(finding("extractor", "/payload/extractionReceipt/disposition", "EXTRACTION_RECEIPT_NOT_EXTRACTED", "The exact extraction receipt must be EXTRACTED."));
  }
  if (payload.extractionReceipt.carrierBlackout !== true) {
    findings.push(finding("blackout", "/payload/extractionReceipt/carrierBlackout", "CARRIER_BLACKOUT_NOT_ESTABLISHED", "Carrier blackout must be established before evaluation."));
  }
  if (payload.extractionReceipt.graphDigest !== payload.graphDigest) {
    findings.push(finding("graph-lineage", "/payload/extractionReceipt/graphDigest", "EXTRACTION_GRAPH_LINEAGE_DIVERGED", "Extraction and evaluation must bind the same canonical graph digest."));
  }
  if (payload.extractionReceipt.validatorReceiptDigest !== payload.validatorReceipt.receiptDigest) {
    findings.push(finding("receipt-lineage", "/payload/extractionReceipt/validatorReceiptDigest", "VALIDATOR_EXTRACTION_RECEIPT_LINEAGE_DIVERGED", "Extraction must bind the exact validator receipt."));
  }
  for (const [index, evidence] of payload.evidence.entries()) {
    const evidencePath = `/payload/evidence/${index}`;
    if (evidence.graphDigest !== payload.graphDigest) {
      findings.push(finding("graph-lineage", `${evidencePath}/graphDigest`, "EVIDENCE_GRAPH_LINEAGE_DIVERGED", `Evidence '${evidence.evidenceId}' does not bind the evaluated graph.`));
    }
    if (evidence.producerCapabilityId === payload.evaluatorCapabilityId || evidence.manufacturedByEvaluator !== false) {
      findings.push(finding("evidence-origin", evidencePath, "EVALUATOR_MANUFACTURED_EVIDENCE", `Evidence '${evidence.evidenceId}' was not independently manufactured.`));
    }
    if (evidence.disposition !== "PASS") {
      findings.push(finding("proof", `${evidencePath}/disposition`, "EVIDENCE_OBLIGATION_NOT_SATISFIED", `Evidence '${evidence.evidenceId}' did not pass.`));
    }
  }

  orderFindings(findings);
  const evidenceInputDigest = canonicalJsonDigest(payload);
  let disposition;
  if (findings.length > 0) disposition = "EVALUATION_HELD";
  else if (payload.subject.kind === "EVALUATOR_REPLACEMENT") disposition = "EVALUATOR_REPLACEMENT_REQUIRES_INDEPENDENT_ADJUDICATION";
  else disposition = "REVIEW_READY_NON_EVALUATOR_SUBJECT";
  if (!acceptanceAuthority.dispositions.includes(disposition)) {
    throw new Error(`SEMANTIC_CARRIER_EVALUATOR_DISPOSITION_NOT_ADMITTED:${disposition}`);
  }
  if (payload.subject.kind !== "EVALUATOR_REPLACEMENT" && disposition === "EVALUATOR_REPLACEMENT_REQUIRES_INDEPENDENT_ADJUDICATION") {
    throw new Error("SEMANTIC_CARRIER_EVALUATOR_INDEPENDENT_ROUTE_SCOPE_VIOLATED");
  }
  const result = {
    contractId: "semantic-carrier-compilation-evaluation-result.v1",
    graphDigest: payload.graphDigest,
    subjectKind: payload.subject.kind,
    subjectCapabilityId: payload.subject.capabilityId,
    evaluatorCapabilityId: payload.evaluatorCapabilityId,
    evaluatorManufacturedEvidenceCount: findings.filter(({ code }) => code === "EVALUATOR_MANUFACTURED_EVIDENCE").length,
    evidenceInputDigest,
    disposition,
    findings,
  };
  return { ...result, receiptDigest: canonicalJsonDigest(result) };
}

export function invokeScenarioSemanticCarrierCompilationEvaluation(configuration, input, bindingUrl) {
  const providerAuthority = readBoundAuthority(configuration?.providerAuthorityRef, configuration?.providerAuthorityDigest, bindingUrl);
  const evaluationProfile = readBoundAuthority(configuration?.evaluationProfileRef, configuration?.evaluationProfileDigest, bindingUrl);
  const acceptanceAuthority = readBoundAuthority(configuration?.acceptanceAuthorityRef, configuration?.acceptanceAuthorityDigest, bindingUrl);
  const inputContract = readBoundAuthority(configuration?.inputContractRef, configuration?.inputContractDigest, bindingUrl);
  const resultContract = readBoundAuthority(configuration?.resultContractRef, configuration?.resultContractDigest, bindingUrl);
  if (providerAuthority.lifecycle !== "ADMITTED" || evaluationProfile.lifecycle !== "ADMITTED" || acceptanceAuthority.lifecycle !== "ADMITTED") {
    throw new Error("SEMANTIC_CARRIER_EVALUATOR_AUTHORITY_NOT_ADMITTED");
  }
  const inputAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validateInput = inputAjv.compile(inputContract);
  if (!validateInput(input)) throw new Error(`SEMANTIC_CARRIER_EVALUATION_INPUT_SCHEMA_REJECTED:${normalizedAjvMessage(validateInput.errors)}`);
  const result = evaluateScenarioSemanticCarrierCompilation(input, evaluationProfile, acceptanceAuthority);
  const resultAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validateResult = resultAjv.compile(resultContract);
  if (!validateResult(result)) throw new Error(`SEMANTIC_CARRIER_EVALUATION_RESULT_SCHEMA_REJECTED:${normalizedAjvMessage(validateResult.errors)}`);
  return result;
}
