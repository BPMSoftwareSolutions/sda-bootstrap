import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createNodeMechanicRegistry } from "../../../languages/typescript/runtimes/node/node-mechanic-registry-loader.mjs";
import {
  canonicalJsonDigest,
  evaluateProofBinding,
  invokeProofBindingEvaluation,
  sha256
} from "../../../languages/typescript/runtimes/node/proof-binding-evaluation-provider.mjs";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const repositoryRoot = new URL("../../../", import.meta.url);
const providerAuthorityRef = "capabilities/sda-platform/bind-profile-governed-proof-binding-evaluation/profile-governed-proof-binding-evaluator.authority.json";
const conformanceReceiptRef = "capabilities/sda-platform/verify-proof-binding-evaluation-conformance/conformance/proof-binding-evaluation-provider-conformance.v1.json";
const fixtureManifestRef = "capabilities/sda-platform/verify-proof-binding-evaluation-conformance/fixtures/fixture-manifest.authority.json";
const profileRef = "capabilities/sda-platform/verify-proof-binding-evaluation-conformance/fixtures/generic-proof-binding-profile.v1.json";
const inputContractRef = "capabilities/sda-platform/bind-profile-governed-proof-binding-evaluation/contracts/profile-governed-proof-binding-evaluation-input.v1.schema.json";
const recordContractRef = "capabilities/sda-platform/bind-profile-governed-proof-binding-evaluation/contracts/profile-governed-proof-binding-evaluation-record.v1.schema.json";

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
  assert.equal(authority.authorityDigest, canonicalJsonDigest(withoutProperty(authority, "authorityDigest")), `${reference} authorityDigest`);
  return authority;
}

function configuration() {
  return {
    profileRef,
    profileDigest: repositoryFileDigest(profileRef),
    inputContractRef,
    inputContractDigest: repositoryFileDigest(inputContractRef),
    recordContractRef,
    recordContractDigest: repositoryFileDigest(recordContractRef),
    providerAuthorityRef,
    providerAuthorityDigest: repositoryFileDigest(providerAuthorityRef)
  };
}

function profile() {
  return readRepositoryJson(profileRef);
}

function pinInput(input) {
  const payload = { ...input.payload };
  delete payload.reproduction;
  const reproduction = { evaluationRuleIds: input.payload.reproduction.evaluationRuleIds };
  return { ...input, payload: { ...payload, reproduction: { orderedInputDigest: canonicalJsonDigest({ ...payload, reproduction }), ...reproduction } } };
}

function carrierInput(fixtureReference) {
  return readRepositoryJson(fixtureReference);
}

function manifestCases() {
  const manifest = readRepositoryJson(fixtureManifestRef);
  const artifacts = new Map(manifest.artifacts.map((artifact) => [artifact.artifactId, artifact]));
  return manifest.cases.map((entry) => {
    const artifact = artifacts.get(entry.carrierArtifactId);
    const input = carrierInput(`capabilities/sda-platform/verify-proof-binding-evaluation-conformance/fixtures/${artifact.path}`);
    return { entry, input };
  });
}

test("PROFILE_BOUNDARY_AND_EVALUATION_ORDER", () => {
  const evaluated = evaluateProofBinding(manifestCases()[0].input, profile());
  assert.equal(evaluated.profileId, profile().profileType);
  assert.equal(evaluated.obligationDisposition, "SATISFIED");

  assert.throws(() => invokeProofBindingEvaluation(configuration(), { ...manifestCases()[0].input, payload: { ...manifestCases()[0].input.payload, profileId: "other-profile.v1" } }, repositoryRoot), (error) => error.message.startsWith("PROOF_BINDING_PROFILE_ID_MISMATCH"));

  const exclusion = manifestCases().find(({ entry }) => entry.evaluationCaseId === "admitted-exclusion-is-not-applicable");
  const exclusionRecord = invokeProofBindingEvaluation(configuration(), exclusion.input, repositoryRoot);
  assert.equal(exclusionRecord.obligationDisposition, "NOT_APPLICABLE");
});

test("PROFILE_RULES_AND_DECLARED_EVALUATION_IDENTITIES", () => {
  const { input } = manifestCases().find(({ entry }) => entry.evaluationCaseId === "explicit-current-passing-binding");
  const admittedProfile = profile();
  assert.throws(() => evaluateProofBinding(input, { ...admittedProfile, bindingRules: [] }), /PROOF_BINDING_PROFILE_BINDING_RULES_INVALID/);
  assert.throws(() => evaluateProofBinding(input, { ...admittedProfile, evaluationOrder: [...admittedProfile.evaluationOrder].reverse() }), /PROOF_BINDING_PROFILE_EVALUATION_ORDER_INVALID/);
  assert.throws(() => evaluateProofBinding(input, { ...admittedProfile, obligationDispositions: [] }), /PROOF_BINDING_PROFILE_OBLIGATION_DISPOSITIONS_INVALID/);
  assert.throws(() => evaluateProofBinding(input, { ...admittedProfile, lifecycle: "PROPOSED" }), /PROOF_BINDING_PROFILE_NOT_ADMITTED/);

  const arbitraryRuleInput = structuredClone(input);
  arbitraryRuleInput.payload.reproduction.evaluationRuleIds = ["evaluation-order.v1", "arbitrary-unadmitted-rule.v999"];
  assert.throws(() => evaluateProofBinding(arbitraryRuleInput, admittedProfile), /PROOF_BINDING_DECLARED_EVALUATION_RULE_IDS_INVALID/);

  const omittedKnownRuleInput = structuredClone(input);
  omittedKnownRuleInput.payload.reproduction.evaluationRuleIds = ["evaluation-order.v1", "bind-fixture-scenario.v1"];
  const omittedKnownRuleRecord = evaluateProofBinding(omittedKnownRuleInput, admittedProfile);
  assert.equal(omittedKnownRuleRecord.reproduction.reproductionDisposition, "NOT_REPRODUCIBLE");
  assert.deepEqual(omittedKnownRuleRecord.findingCodes, ["REPRODUCTION_PIN_MISMATCH"]);
});

test("REAL_REGISTRY_INVOCATION_SEAM", async () => {
  const registry = createNodeMechanicRegistry({
    bindingUrl: repositoryRoot,
    invokeBinding: async () => { throw new Error("unexpected nested invocation"); }
  });
  const port = registry.eventPorts.get("sda-proof-binding-evaluation-port.v1");
  assert.equal(typeof port, "function");
  const { input } = manifestCases().find(({ entry }) => entry.evaluationCaseId === "explicit-current-passing-binding");
  assert.deepEqual(await port({ configuration: configuration() }, input), invokeProofBindingEvaluation(configuration(), input, repositoryRoot));
});

test("EXCLUDED_OBLIGATION_NOT_APPLICABLE", () => {
  const { entry, input } = manifestCases().find(({ entry }) => entry.evaluationCaseId === "admitted-exclusion-is-not-applicable");
  const record = invokeProofBindingEvaluation(configuration(), input, repositoryRoot);
  assert.equal(record.bindingDisposition, "NOT_EVALUATED");
  assert.equal(record.obligationDisposition, "NOT_APPLICABLE");
  assert.deepEqual(record.findingCodes, ["OBLIGATION_EXCLUDED_BY_ADMITTED_AUTHORITY"]);
  assert.equal(record.reproduction.reproductionDisposition, "REPRODUCIBLE");
  assert.deepEqual({ ...entry.expected }, { obligationDisposition: record.obligationDisposition, bindingDisposition: record.bindingDisposition, findingCodes: record.findingCodes, reproductionDisposition: record.reproduction.reproductionDisposition });
});

test("ABSENCE_DOES_NOT_MEAN_FAILURE", () => {
  const { input } = manifestCases().find(({ entry }) => entry.evaluationCaseId === "missing-evidence-is-not-observable");
  const record = invokeProofBindingEvaluation(configuration(), input, repositoryRoot);
  assert.equal(record.obligationDisposition, "NOT_OBSERVABLE");
  assert.equal(record.bindingDisposition, "NOT_OBSERVABLE");
  assert.deepEqual(record.findingCodes, ["REQUIRED_EVIDENCE_ABSENT"]);

  const boundAbsent = pinInput({
    ...input,
    payload: {
      ...input.payload,
      evaluationCaseId: "bound-absent-boundary",
      bindingCandidates: [{ fromSemanticObjectId: "fixture:bound-absent", relationshipKind: "FIXTURE_EXERCISES_SCENARIO", toSemanticObjectId: "scenario:bound-absent", basis: "EXPLICIT_AUTHORITY", lineageState: "CURRENT" }],
      evidenceState: "ABSENT",
      reproduction: {
        ...input.payload.reproduction,
        evaluationRuleIds: ["evaluation-order.v1", "bind-fixture-scenario.v1", "bind-evidence-subject.v1"]
      }
    }
  });
  const boundAbsentRecord = evaluateProofBinding(boundAbsent, profile());
  assert.equal(boundAbsentRecord.obligationDisposition, "NOT_OBSERVABLE");
  assert.equal(boundAbsentRecord.bindingDisposition, "BOUND");
  assert.deepEqual(boundAbsentRecord.findingCodes, ["REQUIRED_EVIDENCE_ABSENT"]);
});

test("PROHIBITED_BASIS_REJECTION", () => {
  const prohibited = ["DIRECTORY_PROXIMITY", "MATCHING_PROSE", "LEXICAL_SIMILARITY", "EMBEDDING_SIMILARITY", "MODEL_TESTIMONY"];
  for (const basis of prohibited) {
    const input = pinInput({
      ...manifestCases()[0].input,
      payload: {
        ...manifestCases()[0].input.payload,
        evaluationCaseId: `prohibited-${basis}`,
        bindingCandidates: [{ fromSemanticObjectId: "fixture:prohibited", relationshipKind: "FIXTURE_EXERCISES_SCENARIO", toSemanticObjectId: "scenario:prohibited", basis, lineageState: "CURRENT" }]
      }
    });
    const record = evaluateProofBinding(input, profile());
    assert.equal(record.bindingDisposition, "REJECTED");
    assert.equal(record.obligationDisposition, "NOT_OBSERVABLE");
    assert.deepEqual(record.findingCodes, ["PROHIBITED_PROOF_BINDING_BASIS"]);
  }

  const proximity = manifestCases().find(({ entry }) => entry.evaluationCaseId === "prohibited-proximity-basis-is-rejected");
  const proximityRecord = invokeProofBindingEvaluation(configuration(), proximity.input, repositoryRoot);
  assert.equal(proximityRecord.bindingDisposition, "REJECTED");
  assert.deepEqual(proximityRecord.findingCodes, ["PROHIBITED_PROOF_BINDING_BASIS"]);
});

test("STALE_OR_MIXED_LINEAGE_REJECTION", () => {
  for (const lineageState of ["STALE", "MIXED"]) {
    const input = pinInput({
      ...manifestCases()[0].input,
      payload: {
        ...manifestCases()[0].input.payload,
        evaluationCaseId: `lineage-${lineageState}`,
        bindingCandidates: [{ fromSemanticObjectId: "evidence:stale", relationshipKind: "EVIDENCE_PROVES_SUBJECT", toSemanticObjectId: "obligation:stale", basis: "EXPLICIT_AUTHORITY", lineageState }],
        evidenceState: lineageState === "STALE" ? "STALE" : "MIXED_LINEAGE"
      }
    });
    const record = evaluateProofBinding(input, profile());
    assert.equal(record.bindingDisposition, "REJECTED");
    assert.equal(record.obligationDisposition, "NOT_OBSERVABLE");
    assert.deepEqual(record.findingCodes, ["STALE_OR_MIXED_PROOF_LINEAGE"]);
  }

  const stale = manifestCases().find(({ entry }) => entry.evaluationCaseId === "stale-or-mixed-lineage-is-rejected");
  const staleRecord = invokeProofBindingEvaluation(configuration(), stale.input, repositoryRoot);
  assert.equal(staleRecord.bindingDisposition, "REJECTED");
  assert.deepEqual(staleRecord.findingCodes, ["STALE_OR_MIXED_PROOF_LINEAGE"]);

  const staleEvidence = manifestCases().find(({ entry }) => entry.evaluationCaseId === "stale-evidence-current-binding");
  const staleEvidenceRecord = invokeProofBindingEvaluation(configuration(), staleEvidence.input, repositoryRoot);
  assert.equal(staleEvidenceRecord.bindingDisposition, "BOUND");
  assert.equal(staleEvidenceRecord.obligationDisposition, "NOT_OBSERVABLE");
  assert.deepEqual(staleEvidenceRecord.findingCodes, ["STALE_OR_MIXED_PROOF_LINEAGE"]);
});

test("CURRENT_PASSING_SATISFIED", () => {
  const { input } = manifestCases().find(({ entry }) => entry.evaluationCaseId === "explicit-current-passing-binding");
  const record = invokeProofBindingEvaluation(configuration(), input, repositoryRoot);
  assert.equal(record.obligationDisposition, "SATISFIED");
  assert.equal(record.bindingDisposition, "BOUND");
  assert.deepEqual(record.findingCodes, []);
});

test("CURRENT_FAILING_NOT_SATISFIED", () => {
  const { input } = manifestCases().find(({ entry }) => entry.evaluationCaseId === "current-failing-evidence-is-not-satisfied");
  const record = invokeProofBindingEvaluation(configuration(), input, repositoryRoot);
  assert.equal(record.obligationDisposition, "NOT_SATISFIED");
  assert.equal(record.bindingDisposition, "BOUND");
  assert.deepEqual(record.findingCodes, ["CURRENT_EVIDENCE_EXPLICIT_FAILURE"]);
});

test("EXACTLY_ONE_DISPOSITION_PER_OBLIGATION", () => {
  const obligations = new Map();
  for (const { entry, input } of manifestCases()) {
    const record = invokeProofBindingEvaluation(configuration(), input, repositoryRoot);
    const previous = obligations.get(record.proofObligationId);
    assert.ok(previous === undefined || previous === record.obligationDisposition, `duplicate obligation ${record.proofObligationId}`);
    obligations.set(record.proofObligationId, record.obligationDisposition);
  }
});

test("DETERMINISTIC_REPRODUCTION", () => {
  const reordered = manifestCases().filter(({ entry }) => entry.evaluationCaseId === "reordered-candidate-discovery");
  assert.equal(reordered.length, 2);
  const [first, second] = reordered.map(({ input }) => invokeProofBindingEvaluation(configuration(), input, repositoryRoot));
  assert.deepEqual(first, second);
  assert.equal(first.reproduction.reproductionDisposition, "REPRODUCIBLE");
  assert.equal(first.reproduction.orderedInputDigest, second.reproduction.orderedInputDigest);

  const pinned = manifestCases().find(({ entry }) => entry.evaluationCaseId === "pinned-inputs-reproduce-deterministically");
  const pinnedRecord = invokeProofBindingEvaluation(configuration(), pinned.input, repositoryRoot);
  assert.equal(pinnedRecord.reproduction.orderedInputDigest, pinned.input.payload.reproduction.orderedInputDigest);

  const mismatch = manifestCases().find(({ entry }) => entry.evaluationCaseId === "reproduction-pin-mismatch");
  const mismatchRecord = invokeProofBindingEvaluation(configuration(), mismatch.input, repositoryRoot);
  assert.equal(mismatchRecord.reproduction.reproductionDisposition, "NOT_REPRODUCIBLE");
  assert.deepEqual(mismatchRecord.findingCodes, ["REPRODUCTION_PIN_MISMATCH"]);
  const mismatchMaterial = Object.fromEntries(Object.entries(mismatch.input.payload).filter(([key]) => key !== "reproduction"));
  assert.equal(mismatchRecord.reproduction.orderedInputDigest, canonicalJsonDigest({
    ...mismatchMaterial,
    reproduction: { evaluationRuleIds: mismatch.input.payload.reproduction.evaluationRuleIds }
  }));
});

test("CONTRACT_ADMISSION_AND_RECEIPT_DIGEST", () => {
  const fixtureManifest = readRepositoryJson(fixtureManifestRef);
  const conformance = readRepositoryJson(conformanceReceiptRef);
  assert.equal(fixtureManifest.lifecycle, "ADMITTED");
  assert.deepEqual(fixtureManifest.admissionClaims, {
    providerConformance: "SATISFIED",
    runtimeProjection: "SATISFIED",
    receiptIssuance: "SATISFIED"
  });
  assert.equal(conformance.lifecycle, "ADMITTED");
  assert.equal(conformance.fixtureManifestDigest, repositoryFileDigest(fixtureManifestRef));
  assert.equal(conformance.fixtureSetDigest, fixtureManifest.fixtureSetDigest);
  assert.equal(conformance.receiptDigest, canonicalJsonDigest(withoutProperty(conformance, "receiptDigest")));
  assert.equal(conformance.disposition, "SDA_PROOF_BINDING_EVALUATION_PROVIDER_CONFORMANT");
  assert.equal(conformance.partitions.length, 12);
  assert.equal(new Set(conformance.partitions.map(({ partitionId }) => partitionId)).size, 12);
  assert.ok(conformance.partitions.every(({ disposition, evidenceDigests, reason }) => disposition === "SATISFIED" && evidenceDigests.length > 0 && reason === null));
  assert.deepEqual(conformance.findings, []);

  const requestSchema = readRepositoryJson("capabilities/sda-platform/verify-proof-binding-evaluation-conformance/contracts/proof-binding-evaluation-provider-conformance-request.v1.schema.json");
  assert.equal(requestSchema.properties.providerAuthorityBinding.properties.authorityId.const, "profile-governed-proof-binding-evaluator.v1");
  assert.equal(requestSchema.$defs.partitionId.enum.length, 12);

  const authoritySchema = readRepositoryJson("capabilities/sda-platform/bind-profile-governed-proof-binding-evaluation/contracts/profile-governed-proof-binding-evaluator.authority.schema.json");
  const authorityValidator = new Ajv2020({ allErrors: true, strict: true, validateFormats: false }).compile(authoritySchema);
  assert.equal(authorityValidator(readRepositoryJson(providerAuthorityRef)), true, JSON.stringify(authorityValidator.errors));

  const conformanceSchema = readRepositoryJson("capabilities/sda-platform/verify-proof-binding-evaluation-conformance/contracts/proof-binding-evaluation-provider-conformance.v1.schema.json");
  const conformanceValidator = new Ajv2020({ allErrors: true, strict: true, validateFormats: false }).compile(conformanceSchema);
  assert.equal(conformanceValidator(conformance), true, JSON.stringify(conformanceValidator.errors));
  const rejected = structuredClone(conformance);
  rejected.disposition = "SDA_PROOF_BINDING_EVALUATION_PROVIDER_REJECTED";
  rejected.partitions[0] = { ...rejected.partitions[0], disposition: "NOT_SATISFIED", reason: "deterministic partition failure" };
  rejected.findings = [{ code: "PARTITION_FAILED", subjectRef: "PROFILE_BOUNDARY_AND_EVALUATION_ORDER", message: "deterministic partition failure" }];
  assert.equal(conformanceValidator(rejected), true, JSON.stringify(conformanceValidator.errors));
});

test("PROVIDER_AND_AUTHORITY_IDENTITIES", () => {
  const provider = assertAuthorityDigest(providerAuthorityRef);
  assert.equal(provider.platformCapabilityId, "sda-proof-binding-evaluation-port.v1");
  assert.equal(provider.authorityType, "profile-governed-proof-binding-evaluator-authority.v1");
  assert.deepEqual(provider.subordinateAuthorities, []);
  assert.equal(provider.providerObservation.disposition, "SATISFIED");
  assert.equal(provider.providerObservation.registryBindingDigest, repositoryFileDigest(provider.providerObservation.registryBindingRef));
  assert.equal(provider.runtimeDependencies.packageLockDigest, repositoryFileDigest(provider.runtimeDependencies.packageLockRef));
  for (const source of provider.providerObservation.providerSourceSet) {
    assert.equal(source.sourceDigest, repositoryFileDigest(source.sourceRef));
  }
  const registry = readRepositoryJson("kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json");
  const registrationEntry = registry.eventPorts.find((entry) => entry.platformCapabilityId === "sda-proof-binding-evaluation-port.v1");
  assert.ok(registrationEntry);
  assert.equal(registrationEntry.registrationAuthorityDigest, repositoryFileDigest(registrationEntry.registrationAuthorityRef));
  const registration = assertAuthorityDigest(registrationEntry.registrationAuthorityRef);
  for (const property of ["platformCapabilityId", "kind", "providerModule", "providerExport", "invocation"]) {
    assert.equal(registrationEntry[property], registration[property], property);
  }
  assert.equal(provider.providerObservation.registryBindingRef, registrationEntry.registrationAuthorityRef);
  assert.equal(provider.providerObservation.registryBindingDigest, registrationEntry.registrationAuthorityDigest);

  const catalog = readRepositoryJson("kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json");
  const catalogEntry = catalog.capabilities.find(({ capabilityId, projectionTarget }) => capabilityId === "sda-proof-binding-evaluation-port.v1" && projectionTarget === "node");
  const conformance = readRepositoryJson(conformanceReceiptRef);
  assert.ok(catalogEntry);
  assert.equal(catalogEntry.providerAuthorityRef, providerAuthorityRef);
  assert.equal(catalogEntry.providerAuthorityDigest, provider.authorityDigest);
  assert.equal(catalogEntry.conformanceDigest, conformance.receiptDigest);
});

test("ORDERED_EVIDENCE_FINDINGS", () => {
  for (const { entry, input } of manifestCases()) {
    const record = invokeProofBindingEvaluation(configuration(), input, repositoryRoot);
    assert.deepEqual(record.findingCodes, [...new Set(record.findingCodes)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
    assert.equal(record.obligationDisposition, entry.expected.obligationDisposition);
    assert.equal(record.bindingDisposition, entry.expected.bindingDisposition);
    assert.deepEqual(record.findingCodes, entry.expected.findingCodes);
    assert.equal(record.reproduction.reproductionDisposition, entry.expected.reproductionDisposition);
  }
});
