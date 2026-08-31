import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import {
  canonicalJsonDigest,
  embedReferenceVector,
  invokeSemanticVectorIndex,
  overlapScore,
  sha256
} from "../../../languages/typescript/runtimes/node/semantic-vector-index-provider.mjs";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;

const repositoryRoot = new URL("../../../", import.meta.url);
const capabilityRoot = "capabilities/sda-platform/bind-deterministic-semantic-vector-index";
const providerAuthorityRef = `${capabilityRoot}/deterministic-semantic-vector-indexer.authority.json`;
const inputContractRef = `${capabilityRoot}/contracts/semantic-vector-index-input.v1.schema.json`;
const recordContractRef = `${capabilityRoot}/contracts/semantic-vector-index-record.v1.schema.json`;
const authoritySchemaRef = `${capabilityRoot}/contracts/deterministic-semantic-vector-indexer.authority.schema.json`;
const conformanceReceiptRef = "capabilities/sda-platform/verify-semantic-vector-index-conformance/conformance/semantic-vector-index-provider-conformance.v1.json";

const readJson = (reference) => JSON.parse(fs.readFileSync(new URL(reference, repositoryRoot), "utf8"));
const fileDigest = (reference) => sha256(fs.readFileSync(new URL(reference, repositoryRoot)));
const withoutProperty = (document, property) =>
  Object.fromEntries(Object.entries(document).filter(([key]) => key !== property));

const configuration = {
  inputContractRef,
  inputContractDigest: fileDigest(inputContractRef),
  recordContractRef,
  recordContractDigest: fileDigest(recordContractRef),
  providerAuthorityRef,
  providerAuthorityDigest: fileDigest(providerAuthorityRef)
};

const CORPUS = [
  { semanticObjectId: "capability:observe-governed-repository", searchRepresentation: "observe-governed-repository", catalogOrdinal: 0 },
  { semanticObjectId: "capability:operate-tooling-migration-verify", searchRepresentation: "operate-tooling-migration-verify", catalogOrdinal: 1 },
  { semanticObjectId: "capability:audit-controlled-tooling-migration-batch", searchRepresentation: "audit-controlled-tooling-migration-batch", catalogOrdinal: 2 },
  { semanticObjectId: "artifact:unrelated-subject", searchRepresentation: "zzz-entirely-unrelated-subject", catalogOrdinal: 3 }
];
const SNAPSHOT = `sha256:${"a".repeat(64)}`;
const CATALOG = `sha256:${"b".repeat(64)}`;

const invoke = (overrides = {}) => invokeSemanticVectorIndex(configuration, {
  contractId: "semantic-vector-index-input.v1",
  payload: {
    embeddingModelId: "sidefx-trigram-reference-embedding.v1",
    embeddingParameters: { gramSize: 3, caseFold: true },
    corpus: CORPUS,
    queryTerms: ["tooling migration"],
    minimumOverlapScore: 1,
    limit: 10,
    snapshotDigest: SNAPSHOT,
    catalogDigest: CATALOG,
    ...overrides
  }
}, repositoryRoot);

test("provider authority recomputes its own canonical digest", () => {
  const authority = readJson(providerAuthorityRef);
  assert.equal(authority.authorityDigest, canonicalJsonDigest(withoutProperty(authority, "authorityDigest")));
  assert.equal(authority.lifecycle, "ADMITTED");
  assert.equal(authority.platformCapabilityId, "sda-semantic-vector-index.v1");
});

test("provider authority satisfies its own admitted schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validate = ajv.compile(readJson(authoritySchemaRef));
  const authority = readJson(providerAuthorityRef);
  assert.ok(validate(authority), JSON.stringify(validate.errors));
});

test("provider authority pins the exact provider and registry source digests", () => {
  const authority = readJson(providerAuthorityRef);
  for (const source of authority.providerObservation.providerSourceSet) {
    assert.equal(source.sourceDigest, fileDigest(source.sourceRef), source.sourceRef);
  }
  assert.equal(
    authority.providerObservation.registryBindingDigest,
    fileDigest(authority.providerObservation.registryBindingRef)
  );
});

test("provider authority declares no external service and no floating point coordinates", () => {
  const authority = readJson(providerAuthorityRef);
  assert.equal(authority.embeddingModel.externalServiceUsed, false);
  assert.equal(authority.embeddingModel.floatingPointCoordinatesUsed, false);
  assert.equal(authority.embeddingModel.coordinateDomain, "NON_NEGATIVE_INTEGER_NGRAM_COUNTS");
  assert.equal(authority.boundaries.candidatesAreFacts, false);
  assert.equal(authority.boundaries.mayGroundResults, false);
  assert.equal(authority.boundaries.mayAddAuthority, false);
  assert.equal(authority.boundaries.separateEmbeddingCapabilityAdmitted, false);
  assert.equal(authority.boundaries.dispatchRegistrationAdmitted, true);
});

test("the provider is registered as a dispatchable event port", () => {
  // The registry authority is declared data read by a runtime loader, so
  // admitting a new mechanic is an authority-data edit rather than a source
  // edit. Registration is now admitted because the dispatch surface no longer
  // lives in a shared monolithic provider file whose digest every prior
  // admission pins.
  const registry = readJson("kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json");
  const port = registry.eventPorts.find((entry) => entry.platformCapabilityId === "sda-semantic-vector-index.v1");
  assert.ok(port, "registry must declare the vector index event port");
  assert.equal(port.providerModule, "semantic-vector-index-provider.mjs");
  assert.equal(port.providerExport, "invokeSemanticVectorIndex");
  assert.equal(port.registrationAuthorityDigest, fileDigest(port.registrationAuthorityRef));
  const registration = readJson(port.registrationAuthorityRef);
  assert.equal(registration.authorityDigest, canonicalJsonDigest(withoutProperty(registration, "authorityDigest")));
  for (const property of ["platformCapabilityId", "kind", "providerModule", "providerExport", "invocation"]) {
    assert.equal(port[property], registration[property], property);
  }
  const providerAuthority = readJson(providerAuthorityRef);
  assert.equal(providerAuthority.providerObservation.registryBindingRef, port.registrationAuthorityRef);
  assert.equal(providerAuthority.providerObservation.registryBindingDigest, port.registrationAuthorityDigest);
  const receipt = readJson(conformanceReceiptRef);
  assert.ok(
    !receipt.retainedForLaterAdmission.some((item) => item.code === "PORT_DISPATCH_REGISTRATION"),
    "the receipt must no longer retain port dispatch registration as unadmitted"
  );
});

test("record satisfies the admitted record contract", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  const validate = ajv.compile(readJson(recordContractRef));
  assert.ok(validate(invoke()), "record must satisfy semantic-vector-index-record.v1");
});

test("every coordinate and score is a non-negative integer", () => {
  const vector = embedReferenceVector("observe-governed-repository", { gramSize: 3, caseFold: true });
  for (const [gram, count] of Object.entries(vector)) {
    assert.ok(Number.isInteger(count) && count >= 0, `${gram} must be a non-negative integer`);
  }
  for (const candidate of invoke().candidates) {
    assert.ok(Number.isInteger(candidate.overlapScore) && candidate.overlapScore >= 1);
    assert.ok(Number.isInteger(candidate.rank) && candidate.rank >= 0);
  }
});

test("identical pinned inputs reproduce identical record digests", () => {
  const first = invoke();
  const second = invoke();
  assert.equal(first.recordDigest, second.recordDigest);
  assert.equal(first.indexDigest, second.indexDigest);
  assert.equal(first.queryVectorDigest, second.queryVectorDigest);
  assert.deepEqual(first.candidates, second.candidates);
});

test("reordered corpus discovery does not change recall or scores", () => {
  const forward = invoke();
  const reversed = invoke({ corpus: [...CORPUS].reverse() });
  assert.deepEqual(
    forward.candidates.map((candidate) => [candidate.semanticObjectId, candidate.overlapScore]),
    reversed.candidates.map((candidate) => [candidate.semanticObjectId, candidate.overlapScore])
  );
});

test("candidates are ordered by overlap descending then catalog ordinal ascending", () => {
  const record = invoke();
  assert.equal(record.orderingRule, "overlap score descending, then catalog ordinal ascending");
  for (let index = 1; index < record.candidates.length; index += 1) {
    const previous = record.candidates[index - 1];
    const current = record.candidates[index];
    assert.ok(
      previous.overlapScore > current.overlapScore ||
      (previous.overlapScore === current.overlapScore && previous.catalogOrdinal < current.catalogOrdinal),
      `candidate ${index} violates the declared ordering rule`
    );
    assert.equal(current.rank, index);
  }
});

test("overlap similarity is symmetric and uses integer arithmetic only", () => {
  const left = embedReferenceVector("tooling migration", { gramSize: 3, caseFold: true });
  const right = embedReferenceVector("operate-tooling-migration-verify", { gramSize: 3, caseFold: true });
  const forward = overlapScore(left, right);
  const backward = overlapScore(right, left);
  assert.equal(forward, backward);
  assert.ok(Number.isInteger(forward));
});

test("recall reaches novel wording that exact substring containment misses", () => {
  const substringRecall = (term) => CORPUS.filter((member) => member.searchRepresentation.includes(term));
  for (const wording of ["tooling migration", "migration tooling", "toolign-migration"]) {
    assert.equal(substringRecall(wording).length, 0, `${wording} must be invisible to substring recall`);
    const recalled = invoke({ queryTerms: [wording], minimumOverlapScore: 5 }).candidates;
    assert.ok(recalled.length > 0, `${wording} must be recalled by the vector channel`);
    assert.ok(
      recalled.some((candidate) => candidate.semanticObjectId.includes("tooling-migration")),
      `${wording} must recall the tooling-migration subjects`
    );
  }
});

test("an unrelated subject is not recalled above the declared minimum overlap", () => {
  const recalled = invoke({ queryTerms: ["tooling migration"], minimumOverlapScore: 5 }).candidates;
  assert.ok(!recalled.some((candidate) => candidate.semanticObjectId === "artifact:unrelated-subject"));
});

test("an unadmitted embedding model is rejected", () => {
  assert.throws(() => invoke({ embeddingModelId: "some-other-model.v1" }), /SEMANTIC_VECTOR_EMBEDDING_MODEL_NOT_ADMITTED/u);
});

test("a mismatched authority digest is rejected before evaluation", () => {
  assert.throws(
    () => invokeSemanticVectorIndex(
      { ...configuration, providerAuthorityDigest: `sha256:${"0".repeat(64)}` },
      { contractId: "semantic-vector-index-input.v1", payload: { embeddingModelId: "sidefx-trigram-reference-embedding.v1", embeddingParameters: { gramSize: 3, caseFold: true }, corpus: CORPUS, queryTerms: ["x"], minimumOverlapScore: 1, limit: 10, snapshotDigest: SNAPSHOT, catalogDigest: CATALOG } },
      repositoryRoot
    ),
    /SEMANTIC_VECTOR_AUTHORITY_DIGEST_MISMATCH/u
  );
});

test("a malformed request is rejected by the admitted input contract", () => {
  assert.throws(() => invoke({ minimumOverlapScore: 0 }), /SEMANTIC_VECTOR_INDEX_INPUT_SCHEMA_REJECTED/u);
});

test("the record proposes candidates and claims no grounding or admission", () => {
  const record = invoke();
  for (const forbidden of ["grounded", "groundingDisposition", "admitted", "authority", "conformance"]) {
    assert.ok(!Object.hasOwn(record, forbidden), `record must not carry '${forbidden}'`);
  }
});

test("the conformance receipt recomputes and pins this provider", () => {
  const receipt = readJson(conformanceReceiptRef);
  assert.equal(receipt.receiptDigest, canonicalJsonDigest(withoutProperty(receipt, "receiptDigest")));
  assert.equal(receipt.disposition, "SDA_SEMANTIC_VECTOR_INDEX_PROVIDER_CONFORMANT");
  assert.equal(receipt.providerAuthoritySourceDigest, fileDigest(providerAuthorityRef));
  assert.equal(receipt.providerAuthorityDigest, readJson(providerAuthorityRef).authorityDigest);
  assert.ok(receipt.partitions.every((partition) => partition.disposition === "SATISFIED"));
  for (const source of receipt.providerSourceSet) {
    assert.equal(source.sourceDigest, fileDigest(source.sourceRef), source.sourceRef);
  }
  for (const contract of receipt.contracts) {
    assert.equal(contract.sourceDigest, fileDigest(contract.sourceRef), contract.sourceRef);
  }
});
