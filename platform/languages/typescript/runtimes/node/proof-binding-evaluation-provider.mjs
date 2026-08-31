import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;

const EVALUATION_ORDER_RULE_ID = "evaluation-order.v1";
const EXPECTED_EVALUATION_ORDER = [
  "NOT_APPLICABLE when admitted authority excludes the obligation",
  "NOT_OBSERVABLE when required subject binding or evidence is absent or stale",
  "NOT_SATISFIED when current admitted evidence explicitly fails the obligation",
  "SATISFIED when current admitted evidence explicitly closes the obligation"
];
const EXPECTED_OBLIGATION_DISPOSITIONS = ["SATISFIED", "NOT_SATISFIED", "NOT_OBSERVABLE", "NOT_APPLICABLE"];

const BASIS_PROSE = {
  EXPLICIT_AUTHORITY: "explicit authority",
  DETERMINISTIC_RULE: "deterministic rule",
  DIRECTORY_PROXIMITY: "directory proximity",
  MATCHING_PROSE: "matching prose",
  LEXICAL_SIMILARITY: "lexical similarity",
  EMBEDDING_SIMILARITY: "embedding similarity",
  MODEL_TESTIMONY: "model testimony"
};

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

function decodeUtf8(bytes) {
  let value;
  try { value = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error("PROOF_BINDING_UTF8_INVALID"); }
  if (value.startsWith("\uFEFF")) throw new Error("PROOF_BINDING_BOM_REJECTED");
  return value;
}

function readBoundAuthority(reference, expectedDigest, bindingUrl) {
  if (typeof reference !== "string" || reference.length === 0 || !DIGEST_PATTERN.test(expectedDigest ?? "")) {
    throw new Error("PROOF_BINDING_AUTHORITY_BINDING_INCOMPLETE");
  }
  const url = new URL(reference, bindingUrl);
  if (url.protocol !== "file:") throw new Error("PROOF_BINDING_AUTHORITY_LOCAL_FILE_REQUIRED");
  const bytes = fs.readFileSync(fileURLToPath(url));
  const actualDigest = sha256(bytes);
  if (actualDigest !== expectedDigest) throw new Error(`PROOF_BINDING_AUTHORITY_DIGEST_MISMATCH:${reference}`);
  const source = decodeUtf8(bytes);
  return { reference, digest: actualDigest, source, document: JSON.parse(source) };
}

function normalizedAjvMessage(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.keyword}: ${error.message ?? "schema validation failed"}`)
    .sort(compareCodePoints)
    .join("; ");
}

function compareCandidates(left, right) {
  for (const key of ["fromSemanticObjectId", "relationshipKind", "toSemanticObjectId", "basis", "lineageState"]) {
    const comparison = compareCodePoints(left[key] ?? "", right[key] ?? "");
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function canonicalOrderedInput(payload) {
  const ordered = structuredClone(payload);
  if (Array.isArray(ordered.bindingCandidates)) {
    ordered.bindingCandidates = [...ordered.bindingCandidates].sort(compareCandidates);
  }
  ordered.reproduction = {
    evaluationRuleIds: [...(ordered.reproduction?.evaluationRuleIds ?? [])]
  };
  return ordered;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function hasExactMembers(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    new Set(actual).size === actual.length && expected.every((value) => actual.includes(value));
}

function validateProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile) || profile.lifecycle !== "ADMITTED") {
    throw new Error("PROOF_BINDING_PROFILE_NOT_ADMITTED");
  }
  if (!Array.isArray(profile.bindingRules) || profile.bindingRules.length === 0) {
    throw new Error("PROOF_BINDING_PROFILE_BINDING_RULES_INVALID");
  }

  const bindingRulesByRelationship = new Map();
  const bindingRuleIds = new Set();
  for (const rule of profile.bindingRules) {
    const toKinds = isNonEmptyString(rule?.toKind)
      ? [rule.toKind]
      : Array.isArray(rule?.toKinds) && rule.toKinds.length > 0 && rule.toKinds.every(isNonEmptyString)
        ? rule.toKinds
        : null;
    if (!isNonEmptyString(rule?.ruleId) || !isNonEmptyString(rule?.fromKind) ||
        !isNonEmptyString(rule?.relationshipKind) || toKinds === null ||
        !Array.isArray(rule?.permittedBasis) || rule.permittedBasis.length === 0 || !rule.permittedBasis.every(isNonEmptyString) ||
        !Array.isArray(rule?.permittedBasisKinds) || rule.permittedBasisKinds.length === 0 || !rule.permittedBasisKinds.every(isNonEmptyString) ||
        bindingRuleIds.has(rule.ruleId) || bindingRulesByRelationship.has(rule.relationshipKind)) {
      throw new Error("PROOF_BINDING_PROFILE_BINDING_RULES_INVALID");
    }
    bindingRuleIds.add(rule.ruleId);
    bindingRulesByRelationship.set(rule.relationshipKind, rule);
  }

  if (!Array.isArray(profile.evaluationOrder) || profile.evaluationOrder.length !== EXPECTED_EVALUATION_ORDER.length ||
      profile.evaluationOrder.some((value, index) => value !== EXPECTED_EVALUATION_ORDER[index])) {
    throw new Error("PROOF_BINDING_PROFILE_EVALUATION_ORDER_INVALID");
  }
  if (!Array.isArray(profile.prohibitedBasis) || new Set(profile.prohibitedBasis).size !== profile.prohibitedBasis.length ||
      !profile.prohibitedBasis.every(isNonEmptyString)) {
    throw new Error("PROOF_BINDING_PROFILE_BINDING_RULES_INVALID");
  }
  if (!hasExactMembers(profile.obligationDispositions, EXPECTED_OBLIGATION_DISPOSITIONS) ||
      profile.absenceMeansFailureByDefault !== false || profile.exactlyOneDispositionPerObligation !== true) {
    throw new Error("PROOF_BINDING_PROFILE_OBLIGATION_DISPOSITIONS_INVALID");
  }

  const expectedEvaluationRuleIds = [EVALUATION_ORDER_RULE_ID, ...bindingRuleIds];
  if (!hasExactMembers(profile.evaluationRuleIds, expectedEvaluationRuleIds)) {
    throw new Error("PROOF_BINDING_PROFILE_EVALUATION_RULE_IDS_INVALID");
  }
  return {
    bindingRulesByRelationship,
    evaluationRuleIds: new Set(profile.evaluationRuleIds),
    obligationDispositions: new Set(profile.obligationDispositions),
    prohibitedBasis: new Set(profile.prohibitedBasis)
  };
}

function validateDeclaredEvaluationRules(payload, profileAuthority) {
  const declaredRuleIds = payload.reproduction?.evaluationRuleIds;
  if (!Array.isArray(declaredRuleIds) || declaredRuleIds.length === 0 || new Set(declaredRuleIds).size !== declaredRuleIds.length ||
      !declaredRuleIds.includes(EVALUATION_ORDER_RULE_ID) ||
      declaredRuleIds.some((ruleId) => !profileAuthority.evaluationRuleIds.has(ruleId))) {
    throw new Error("PROOF_BINDING_DECLARED_EVALUATION_RULE_IDS_INVALID");
  }
  for (const candidate of payload.bindingCandidates ?? []) {
    const bindingRule = profileAuthority.bindingRulesByRelationship.get(candidate.relationshipKind);
    if (!bindingRule || !declaredRuleIds.includes(bindingRule.ruleId)) {
      throw new Error(`PROOF_BINDING_DECLARED_BINDING_RULE_MISSING:${candidate.relationshipKind}`);
    }
    if (!new Set(bindingRule.permittedBasisKinds).has(candidate.basis) &&
        !profileAuthority.prohibitedBasis.has(BASIS_PROSE[candidate.basis])) {
      throw new Error(`PROOF_BINDING_BASIS_NOT_PERMITTED:${candidate.basis}`);
    }
  }
}

export function evaluateProofBinding(input, profile) {
  const payload = input.payload;
  const profileAuthority = validateProfile(profile);
  validateDeclaredEvaluationRules(payload, profileAuthority);
  const candidates = Array.isArray(payload.bindingCandidates) ? payload.bindingCandidates : [];
  const prohibitedBasis = new Set(Array.isArray(profile.prohibitedBasis) ? profile.prohibitedBasis : []);
  const evidenceState = payload.evidenceState;

  let bindingDisposition;
  let obligationDisposition;
  const findings = [];

  if (payload.authorityApplicability === "EXCLUDED_BY_ADMITTED_AUTHORITY") {
    bindingDisposition = "NOT_EVALUATED";
    obligationDisposition = "NOT_APPLICABLE";
    findings.push("OBLIGATION_EXCLUDED_BY_ADMITTED_AUTHORITY");
  } else if (candidates.some((candidate) => prohibitedBasis.has(BASIS_PROSE[candidate.basis]))) {
    bindingDisposition = "REJECTED";
    obligationDisposition = "NOT_OBSERVABLE";
    findings.push("PROHIBITED_PROOF_BINDING_BASIS");
  } else if (candidates.some((candidate) => candidate.lineageState === "STALE" || candidate.lineageState === "MIXED")) {
    bindingDisposition = "REJECTED";
    obligationDisposition = "NOT_OBSERVABLE";
    findings.push("STALE_OR_MIXED_PROOF_LINEAGE");
  } else if (candidates.length > 0) {
    bindingDisposition = "BOUND";
    if (evidenceState === "ABSENT") {
      obligationDisposition = "NOT_OBSERVABLE";
      findings.push("REQUIRED_EVIDENCE_ABSENT");
    } else if (evidenceState === "STALE" || evidenceState === "MIXED_LINEAGE") {
      obligationDisposition = "NOT_OBSERVABLE";
      findings.push("STALE_OR_MIXED_PROOF_LINEAGE");
    } else if (evidenceState === "CURRENT_FAILING") {
      obligationDisposition = "NOT_SATISFIED";
      findings.push("CURRENT_EVIDENCE_EXPLICIT_FAILURE");
    } else {
      obligationDisposition = "SATISFIED";
    }
  } else {
    bindingDisposition = "NOT_OBSERVABLE";
    obligationDisposition = "NOT_OBSERVABLE";
    if (evidenceState === "ABSENT") {
      findings.push("REQUIRED_EVIDENCE_ABSENT");
    } else if (evidenceState === "STALE" || evidenceState === "MIXED_LINEAGE") {
      findings.push("STALE_OR_MIXED_PROOF_LINEAGE");
    } else {
      findings.push("REQUIRED_SUBJECT_BINDING_ABSENT");
    }
  }

  if (profile.absenceMeansFailureByDefault !== false && obligationDisposition === "NOT_OBSERVABLE" && findings.includes("REQUIRED_EVIDENCE_ABSENT")) {
    obligationDisposition = "NOT_SATISFIED";
  }
  if (!profileAuthority.obligationDispositions.has(obligationDisposition)) {
    throw new Error(`PROOF_BINDING_OBLIGATION_DISPOSITION_NOT_ADMITTED:${obligationDisposition}`);
  }

  const computedOrderedInputDigest = canonicalJsonDigest(canonicalOrderedInput(payload));
  const reproducible = computedOrderedInputDigest === payload.reproduction.orderedInputDigest;
  if (!reproducible) findings.push("REPRODUCTION_PIN_MISMATCH");

  const record = {
    evaluationCaseId: payload.evaluationCaseId,
    profileId: payload.profileId,
    snapshotDigest: payload.snapshotDigest,
    proofObligationId: payload.proofObligationId,
    subjectSemanticObjectId: payload.subjectSemanticObjectId,
    obligationDisposition,
    bindingDisposition,
    findingCodes: [...new Set(findings)].sort(compareCodePoints),
    reproduction: {
      orderedInputDigest: computedOrderedInputDigest,
      evaluationRuleIds: [...(payload.reproduction.evaluationRuleIds ?? [])],
      reproductionDisposition: reproducible ? "REPRODUCIBLE" : "NOT_REPRODUCIBLE"
    }
  };
  return record;
}

export function invokeProofBindingEvaluation(configuration, input, bindingUrl) {
  const requiredBindings = [
    ["profileRef", "profileDigest"],
    ["inputContractRef", "inputContractDigest"],
    ["recordContractRef", "recordContractDigest"],
    ["providerAuthorityRef", "providerAuthorityDigest"]
  ];
  const authorities = Object.fromEntries(requiredBindings.map(([referenceKey, digestKey]) => [referenceKey, readBoundAuthority(configuration?.[referenceKey], configuration?.[digestKey], bindingUrl)]));
  const inputAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const inputValidator = inputAjv.compile(authorities.inputContractRef.document);
  const recordAjv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const recordValidator = recordAjv.compile(authorities.recordContractRef.document);
  if (!inputValidator(input)) {
    throw new Error(`PROOF_BINDING_EVALUATION_INPUT_SCHEMA_REJECTED:${normalizedAjvMessage(inputValidator.errors)}`);
  }
  const payload = input.payload;
  const profile = authorities.profileRef.document;
  const expectedProfileId = profile.profileType ?? profile.authorityId;
  if (payload.profileId !== expectedProfileId) {
    throw new Error(`PROOF_BINDING_PROFILE_ID_MISMATCH:expected '${expectedProfileId}' observed '${payload.profileId}'`);
  }
  const record = evaluateProofBinding(input, profile);
  if (!recordValidator(record)) {
    throw new Error(`PROOF_BINDING_EVALUATION_RECORD_SCHEMA_REJECTED:${normalizedAjvMessage(recordValidator.errors)}`);
  }
  return record;
}
