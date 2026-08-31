import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  LosslessJsonError,
  canonicalJson,
  canonicalJsonDigest,
  ingestJsonAuthority,
  parseLosslessJson,
  parseLosslessJsonEvidence,
  sha256
} from "../../../languages/typescript/runtimes/node/json-authority-ingestion-provider.mjs";

const schemaDigest = `sha256:${"1".repeat(64)}`;
const authorityDigest = `sha256:${"2".repeat(64)}`;
const repositoryRoot = new URL("../../../", import.meta.url);
const providerAuthorityRef = "capabilities/sda-platform/bind-profile-governed-json-authority-ingestion/profile-governed-json-authority-ingestor.authority.json";
const conformanceReceiptRef = "capabilities/sda-platform/verify-json-authority-ingestion-conformance/conformance/json-authority-ingestion-provider-conformance.v1.json";
const fixtureManifestRef = "capabilities/sda-platform/verify-json-authority-ingestion-conformance/fixtures/fixture-manifest.authority.json";
const profile = { reference: "profile.json", digest: authorityDigest, document: { profileType: "test-json-profile.v1" } };
const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["id", "value", "references"],
  properties: {
    id: { type: "string" },
    value: { type: "string" },
    references: { type: "array", items: { type: "string" } }
  }
};

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

function carrier(value = { id: "valid", value: "retained", references: [] }, overrides = {}) {
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
  return {
    sourceRef: "resource:valid",
    sourceBytesBase64: bytes.toString("base64"),
    sourceDigest: sha256(bytes),
    sourcePointer: "fixture:valid",
    sourceClass: "CANONICAL_AUTHORITY",
    schemaRef: "schema:test.v1",
    schemaDigest,
    declaredVersion: "1.0.0",
    referenceRefs: [],
    ...overrides
  };
}

function bundle(resources = [carrier()]) {
  return {
    requestContractId: "test-json-ingestion-request.v1",
    receiptType: "test-json-ingestion-receipt.v1",
    dispositions: { conformant: "CONFORMANT", open: "OPEN", rejected: "REJECTED" },
    profile,
    membershipPolicy: { reference: "membership.json", digest: authorityDigest, document: { policyType: "test-membership.v1" } },
    canonicalizationPolicy: { reference: "canonicalization.json", digest: authorityDigest, document: { policyType: "test-canonicalization.v1" } },
    receiptContract: { reference: "receipt.schema.json", digest: authorityDigest, document: {} },
    requestContract: { reference: "request.schema.json", digest: authorityDigest, document: {} },
    fixtureManifest: {
      reference: "manifest.json",
      digest: authorityDigest,
      document: {
        fixtureSetDigest: authorityDigest,
        fixtures: resources.map((resource) => ({
          sourcePointer: resource.sourcePointer,
          sourceBytesBase64: resource.sourceBytesBase64,
          sourceDigest: resource.sourceDigest,
          sourceClass: resource.sourceClass
        })),
        schemas: [{ schemaId: "schema:test.v1", path: "schema.json", sourceDigest: schemaDigest, supportedVersions: ["1.0.0"] }]
      }
    },
    schemaCatalog: {
      reference: "schema-catalog.json",
      digest: authorityDigest,
      document: { schemas: [{ schemaRef: "schema:test.v1", sourceRef: "schema.json", sourceDigest: schemaDigest }] }
    },
    referenceScope: { reference: "reference-scope.json", digest: authorityDigest, document: { subjects: [] } },
    versionPolicy: {
      reference: "version-policy.json",
      digest: authorityDigest,
      document: { supportedVersions: [{ documentType: "test.v1", declaredVersion: "1.0.0", schemaRef: "schema:test.v1" }] }
    },
    schemas: new Map([["schema:test.v1", { reference: "schema.json", digest: schemaDigest, document: schema }]]),
    providerAuthority: { authorityId: "sda-json-authority-ingestion-provider.v1", authorityRef: "provider.json", authorityDigest }
  };
}

function request(resources = [carrier()]) {
  return {
    contractId: "test-json-ingestion-request.v1",
    payload: { profileId: "test-json-profile.v1", manifestDigest: authorityDigest, resources }
  };
}

test("EXACT_SOURCE_BYTES_AND_POINTERS", () => {
  const resource = carrier();
  const receipt = ingestJsonAuthority(request([resource]), bundle([resource]));
  assert.equal(receipt.resources[0].sourceBytesBase64, resource.sourceBytesBase64);
  assert.equal(receipt.resources[0].sourceDigest, resource.sourceDigest);
  assert.equal(receipt.resources[0].sourcePointer, resource.sourcePointer);
  const changed = { ...resource, sourceDigest: `sha256:${"f".repeat(64)}` };
  assert.equal(ingestJsonAuthority(request([changed]), bundle([changed])).findings[0].code, "JSON_SOURCE_DIGEST_MISMATCH");
});

test("STRICT_UTF8_AND_LOSSLESS_JSON", () => {
  assert.deepEqual(parseLosslessJson('{"all":[null,true,false,0,1.25,"𐀀",{},[]]}'), { all: [null, true, false, 0, 1.25, "𐀀", {}, []] });
  const lexical = parseLosslessJsonEvidence('{"number":1.0e1}');
  assert.deepEqual(lexical.numberLexemes.map(({ lexeme, canonicalLexeme }) => ({ lexeme, canonicalLexeme })), [{ lexeme: "1.0e1", canonicalLexeme: "10" }]);
  const edgeNumbers = parseLosslessJsonEvidence("[-0,9007199254740993,0.100000000000000005]");
  assert.deepEqual(edgeNumbers.numberLexemes.map(({ lexeme, canonicalLexeme }) => ({ lexeme, canonicalLexeme })), [
    { lexeme: "-0", canonicalLexeme: "0" },
    { lexeme: "9007199254740993", canonicalLexeme: "9007199254740993" },
    { lexeme: "0.100000000000000005", canonicalLexeme: "0.100000000000000005" }
  ]);
  assert.throws(() => parseLosslessJson('"\\ud800"'), LosslessJsonError);
  const numericCarrier = fs.readFileSync(new URL("../../../capabilities/sda-platform/verify-json-authority-ingestion-conformance/fixtures/carriers/number-lexemes.json.source", import.meta.url), "utf8");
  assert.deepEqual(parseLosslessJsonEvidence(numericCarrier).numberLexemes.map(({ lexeme }) => lexeme), ["-0", "1e+30", "9007199254740993", "0.0000000000000000000000001"]);
  const bytes = Buffer.from([0xc3, 0x28]);
  const invalid = carrier(undefined, { sourceBytesBase64: bytes.toString("base64"), sourceDigest: sha256(bytes) });
  assert.equal(ingestJsonAuthority(request([invalid]), bundle([invalid])).findings[0].code, "JSON_UTF8_INVALID");
  const bomBytes = Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]);
  const bom = carrier(undefined, { sourceBytesBase64: bomBytes.toString("base64"), sourceDigest: sha256(bomBytes) });
  assert.equal(ingestJsonAuthority(request([bom]), bundle([bom])).findings[0].code, "JSON_BOM_REJECTED");
});

test("DUPLICATE_OBJECT_KEYS", () => {
  assert.throws(() => parseLosslessJson('{"a":1,"a":2}'), (error) => error.code === "JSON_DUPLICATE_KEY");
  assert.throws(() => parseLosslessJson('{"a":1,"\\u0061":2}'), (error) => error.code === "JSON_DUPLICATE_KEY");
});

test("CANONICAL_JSON_IDENTITY", () => {
  const astral = "𐀀";
  const bmp = "";
  assert.equal(canonicalJson({ [bmp]: 2, [astral]: 1, array: [2, 1] }), `{"array":[2,1],"${bmp}":2,"${astral}":1}`);
  assert.equal(canonicalJsonDigest({ b: 2, a: 1 }), canonicalJsonDigest({ a: 1, b: 2 }));
});

test("DECLARED_SCHEMA_AUTHORITY", () => {
  const absent = carrier(undefined, { schemaRef: "schema:absent.v1", schemaDigest: undefined });
  const receipt = ingestJsonAuthority(request([absent]), bundle([absent]));
  assert.equal(receipt.resources[0].schemaDisposition, "NOT_OBSERVABLE");
  assert.equal(receipt.findings[0].code, "JSON_SCHEMA_MISSING");
});

test("SCHEMA_VALIDATION", () => {
  const invalid = carrier({ id: "bad", value: 7, references: [] });
  const receipt = ingestJsonAuthority(request([invalid]), bundle([invalid]));
  assert.equal(receipt.resources[0].schemaDisposition, "REJECTED");
  assert.equal(receipt.findings[0].code, "JSON_SCHEMA_REJECTED");
});

test("DECLARED_VERSION_POLICY", () => {
  const unsupported = carrier(undefined, { declaredVersion: "2.0.0" });
  const receipt = ingestJsonAuthority(request([unsupported]), bundle([unsupported]));
  assert.equal(receipt.disposition, "OPEN");
  assert.equal(receipt.findings[0].code, "JSON_VERSION_UNSUPPORTED");
});

test("ADMITTED_REFERENCE_CLOSURE", () => {
  const dangling = carrier({ id: "dangling", value: "held", references: ["resource:absent"] }, { referenceRefs: ["resource:absent"] });
  const receipt = ingestJsonAuthority(request([dangling]), bundle([dangling]));
  assert.equal(receipt.resources[0].referenceDisposition, "OPEN");
  assert.equal(receipt.findings[0].code, "JSON_REFERENCE_DANGLING");
});

test("SOURCE_CLASS_NON_ESCALATION", () => {
  for (const sourceClass of ["ADMITTED_EVIDENCE", "PROJECTION_EVIDENCE", "MODEL_TESTIMONY"]) {
    const resource = carrier(undefined, { sourceClass, requestedSourceClass: "CANONICAL_AUTHORITY" });
    const receipt = ingestJsonAuthority(request([resource]), bundle([resource]));
    assert.equal(receipt.resources[0].sourceClass, sourceClass);
    assert.equal(receipt.findings[0].code, "JSON_SOURCE_CLASS_MISMATCH");
  }
});

test("TYPED_DIAGNOSTICS_AND_DISPOSITIONS", () => {
  const malformedBytes = Buffer.from("{", "utf8");
  const malformed = carrier(undefined, { sourceBytesBase64: malformedBytes.toString("base64"), sourceDigest: sha256(malformedBytes) });
  const rejected = ingestJsonAuthority(request([malformed]), bundle([malformed]));
  assert.equal(rejected.disposition, "REJECTED");
  assert.equal(rejected.resources[0].parseDisposition, "REJECTED");
  assert.deepEqual(rejected.findings.map(({ code, severity }) => ({ code, severity })), [{ code: "JSON_PARSE_ERROR", severity: "ERROR" }]);
});

test("PROVIDER_AND_AUTHORITY_IDENTITIES", () => {
  const receipt = ingestJsonAuthority(request(), bundle());
  assert.deepEqual(receipt.providerAuthority, { authorityId: "sda-json-authority-ingestion-provider.v1", authorityRef: "provider.json", authorityDigest });
  assert.equal(receipt.profile.authorityDigest, authorityDigest);
  assert.equal(receipt.membershipPolicy.authorityDigest, authorityDigest);
  assert.equal(receipt.canonicalizationPolicy.authorityDigest, authorityDigest);
  assert.equal(receipt.fixtureManifest.authorityDigest, authorityDigest);

  const parser = assertAuthorityDigest("capabilities/sda-platform/parse-lossless-json-document/lossless-json-parser.authority.json");
  const schemaResolver = assertAuthorityDigest("capabilities/sda-platform/resolve-declared-json-schema-authority/declared-json-schema-authority-resolver.authority.json");
  const referenceResolver = assertAuthorityDigest("capabilities/sda-platform/resolve-admitted-json-reference-closure/admitted-json-reference-closure-resolver.authority.json");
  const provider = assertAuthorityDigest(providerAuthorityRef);
  const subordinateDigests = new Map(provider.subordinateAuthorities.map((entry) => [entry.authorityId, entry.authorityDigest]));
  assert.equal(subordinateDigests.get(parser.authorityId), parser.authorityDigest);
  assert.equal(subordinateDigests.get(schemaResolver.authorityId), schemaResolver.authorityDigest);
  assert.equal(subordinateDigests.get(referenceResolver.authorityId), referenceResolver.authorityDigest);
  for (const observed of [parser.providerObservation, schemaResolver.providerObservation, referenceResolver.providerObservation]) {
    assert.equal(observed.disposition, "SATISFIED");
    assert.equal(observed.providerSourceDigest, repositoryFileDigest(observed.providerSourceRef));
  }
  for (const source of provider.providerObservation.providerSourceSet) {
    assert.equal(source.sourceDigest, repositoryFileDigest(source.sourceRef));
  }
  assert.equal(provider.providerObservation.registryBindingDigest, repositoryFileDigest(provider.providerObservation.registryBindingRef));
  assert.equal(provider.runtimeDependencies.packageLockDigest, repositoryFileDigest(provider.runtimeDependencies.packageLockRef));
  const registry = readRepositoryJson("kernel/semantic-authority/consumer/node-mechanic-registry.authority.v1.json");
  const registrationEntry = registry.eventPorts.find((entry) => entry.platformCapabilityId === "sda-json-authority-ingestion-port.v1");
  assert.ok(registrationEntry);
  assert.equal(registrationEntry.registrationAuthorityDigest, repositoryFileDigest(registrationEntry.registrationAuthorityRef));
  const registration = assertAuthorityDigest(registrationEntry.registrationAuthorityRef);
  for (const property of ["platformCapabilityId", "kind", "providerModule", "providerExport", "invocation"]) {
    assert.equal(registrationEntry[property], registration[property], property);
  }
  assert.equal(provider.providerObservation.registryBindingRef, registrationEntry.registrationAuthorityRef);
  assert.equal(provider.providerObservation.registryBindingDigest, registrationEntry.registrationAuthorityDigest);
});

test("ORDERED_REPRODUCTION_AND_RECEIPT_DIGEST", () => {
  const alpha = carrier({ id: "alpha", value: "a", references: [] }, { sourceRef: "resource:alpha", sourcePointer: "fixture:alpha" });
  const beta = carrier({ id: "beta", value: "b", references: [] }, { sourceRef: "resource:beta", sourcePointer: "fixture:beta" });
  const first = ingestJsonAuthority(request([alpha, beta]), bundle([alpha, beta]));
  const second = ingestJsonAuthority(request([beta, alpha]), bundle([alpha, beta]));
  assert.deepEqual(first, second);
  assert.equal(first.receiptDigest, canonicalJsonDigest(Object.fromEntries(Object.entries(first).filter(([key]) => key !== "receiptDigest"))));

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
  for (const source of conformance.providerObservation.providerSourceSet) {
    assert.equal(source.sourceDigest, repositoryFileDigest(source.sourceRef));
  }
  assert.equal(conformance.receiptDigest, canonicalJsonDigest(withoutProperty(conformance, "receiptDigest")));
  assert.equal(conformance.disposition, "SDA_JSON_AUTHORITY_INGESTION_PROVIDER_CONFORMANT");
  assert.equal(conformance.partitions.length, 12);
  assert.equal(new Set(conformance.partitions.map(({ partitionId }) => partitionId)).size, 12);
  assert.ok(conformance.partitions.every(({ disposition, evidenceDigests, reason }) => disposition === "SATISFIED" && evidenceDigests.length > 0 && reason === null));
  assert.deepEqual(conformance.findings, []);

  const catalog = readRepositoryJson("kernel/semantic-authority/consumer/sda-platform-capabilities.semantic-authority.json");
  const catalogEntry = catalog.capabilities.find(({ capabilityId, projectionTarget }) => capabilityId === "sda-json-authority-ingestion-port.v1" && projectionTarget === "node");
  assert.ok(catalogEntry);
  assert.equal(catalogEntry.providerAuthorityRef, providerAuthorityRef);
  assert.equal(catalogEntry.providerAuthorityDigest, conformance.authorityDigests.provider);
  assert.equal(catalogEntry.conformanceDigest, conformance.receiptDigest);
});
