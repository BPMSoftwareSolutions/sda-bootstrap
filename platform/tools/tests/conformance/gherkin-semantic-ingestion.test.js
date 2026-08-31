"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { Ajv2020 } = require("ajv/dist/2020.js");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const PARSE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "parse-canonical-gherkin-document");
const CASE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "compile-canonical-gherkin-cases");
const PROFILE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "admit-sda-annotated-gherkin-profile");
const BIND_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "bind-canonical-feature-compilation");
const CONFORMANCE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "verify-gherkin-compiler-conformance");
const FIXTURE_ROOT = path.join(CONFORMANCE_ROOT, "fixtures");
const PARTITIONS = [
  "EXACT_BYTES",
  "FEATURE_IDENTITY",
  "SCENARIO_IDENTITY",
  "ORDERED_STEPS",
  "STEP_ARGUMENTS",
  "COMMENTS_AND_NARRATIVE",
  "DIALECT_AND_ADVANCED_CONSTRUCTS",
  "CONNECTOR_REFERENCES",
  "COMPILER_IDENTITIES",
  "AST_CASE_COMPILATION_DIGESTS",
  "TYPED_DIAGNOSTICS",
  "REORDERED_REPRODUCTION"
];

function json(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function digest(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function digestWithout(value, field) {
  const copy = structuredClone(value);
  delete copy[field];
  return digest(copy);
}

function bindNodeIdentitiesToSource(parseEvidence) {
  return parseEvidence.nodeIdentities.map((node) => {
    const pointer = node.sourcePointer === "/" ? "" : node.sourcePointer;
    const input = `${parseEvidence.source.sourceDigest}\u0000${pointer}\u0000${node.nodeKind}\u0000${JSON.stringify(canonicalize(node.location))}`;
    return { ...node, nodeIdentity: `gherkin-node:${createHash("sha256").update(input).digest("hex")}` };
  });
}

async function subject() {
  const provider = await import("../../../artifacts/tools/dist/gherkin/application/canonical-gherkin-compiler.js");
  return {
    ...provider,
    grammarAuthority: json(path.join(PARSE_ROOT, "official-cucumber-gherkin-grammar.authority.json")),
    compilerAuthority: json(path.join(BIND_ROOT, "canonical-gherkin-compiler.authority.json")),
    profileAuthority: json(path.join(PROFILE_ROOT, "sda-annotated-gherkin-profile.v1.json")),
    fixtureManifest: json(path.join(FIXTURE_ROOT, "fixture-manifest.authority.json"))
  };
}

function fixtureSources(manifest) {
  return manifest.fixtures.map((fixture) => ({
    ...fixture,
    sourceRef: path.relative(REPOSITORY_ROOT, path.join(FIXTURE_ROOT, fixture.path)).split(path.sep).join("/"),
    sourceBytesBase64: fs.readFileSync(path.join(FIXTURE_ROOT, fixture.path)).toString("base64")
  }));
}

function parseRequest(api, fixture) {
  return {
    contractId: "canonical-gherkin-parse-request.v1",
    sourceRef: fixture.sourceRef,
    sourceBytesBase64: fixture.sourceBytesBase64,
    mediaType: fixture.mediaType,
    declaredDialect: fixture.declaredDialect,
    grammarBinding: {
      platformCapabilityId: "sda-canonical-gherkin-grammar.v1",
      providerAuthorityRef: "capabilities/sda-platform/parse-canonical-gherkin-document/official-cucumber-gherkin-grammar.authority.json",
      providerAuthorityDigest: api.grammarAuthority.authorityDigest
    }
  };
}

function compileRequest(api, parseEvidence) {
  return {
    contractId: "canonical-gherkin-case-compilation-request.v1",
    parseEvidence,
    parseEvidenceDigest: api.canonicalGherkinDigest(parseEvidence),
    grammarBindingDigest: api.grammarAuthority.authorityDigest
  };
}

function admissionRequest(api, parseEvidence, caseEvidence) {
  return {
    contractId: "sda-annotated-gherkin-profile-admission-request.v1",
    parseEvidence,
    caseEvidence,
    profile: api.profileAuthority,
    profileDigest: api.canonicalGherkinDigest(api.profileAuthority)
  };
}

function conformanceRequest(api) {
  return {
    contractId: "gherkin-compiler-conformance-request.v1",
    compilerAuthority: {
      authorityRef: api.compilerAuthority.authorityRef,
      authorityId: api.compilerAuthority.authorityId,
      authorityDigest: api.compilerAuthority.authorityDigest
    },
    grammarAuthority: {
      authorityRef: api.grammarAuthority.authorityRef,
      authorityId: api.grammarAuthority.authorityId,
      authorityDigest: api.grammarAuthority.authorityDigest
    },
    profileAuthority: {
      authorityRef: "capabilities/sda-platform/admit-sda-annotated-gherkin-profile/sda-annotated-gherkin-profile.v1.json",
      authorityId: api.profileAuthority.profileType,
      authorityDigest: api.canonicalGherkinDigest(api.profileAuthority)
    },
    fixtureCorpus: {
      fixtureSetRef: "capabilities/sda-platform/verify-gherkin-compiler-conformance/fixtures/fixture-manifest.authority.json",
      fixtureSetDigest: api.fixtureManifest.fixtureSetDigest,
      fixtureDigests: api.fixtureManifest.fixtures.map((fixture) => fixture.sourceDigest)
    },
    requiredPartitions: PARTITIONS,
    reproductionRuns: 2
  };
}

function allSchemas() {
  const roots = [PARSE_ROOT, CASE_ROOT, PROFILE_ROOT, BIND_ROOT, CONFORMANCE_ROOT];
  return roots.flatMap((root) => fs.readdirSync(path.join(root, "contracts"))
    .filter((name) => name.endsWith(".schema.json"))
    .map((name) => path.join(root, "contracts", name)))
    .concat(path.join(FIXTURE_ROOT, "fixture-manifest.authority.schema.json"));
}

test("the official grammar, compiler, profile, fixture corpus, and contracts are digest-bound", async () => {
  const api = await subject();
  const schemas = allSchemas().map(json);
  const validator = new Ajv2020({ strict: false, allErrors: true });
  for (const schema of schemas) validator.addSchema(schema);
  for (const schema of schemas) assert.ok(validator.getSchema(schema.$id), schema.$id);

  const admissions = [
    [api.grammarAuthority, "https://schemas.scenario-driven.dev/gherkin/official-cucumber-gherkin-grammar.authority.schema.json"],
    [api.compilerAuthority, "https://schemas.scenario-driven.dev/gherkin/canonical-gherkin-compiler.authority.schema.json"],
    [api.profileAuthority, "https://schemas.scenario-driven.dev/gherkin/sda-annotated-gherkin-profile.v1.schema.json"],
    [api.fixtureManifest, "https://schemas.scenario-driven.dev/gherkin/fixture-manifest.authority.schema.json"]
  ];
  for (const [instance, schemaId] of admissions) {
    const validate = validator.getSchema(schemaId);
    assert.equal(validate(instance), true, JSON.stringify(validate.errors, null, 2));
  }

  assert.equal(digestWithout(api.grammarAuthority, "authorityDigest"), api.grammarAuthority.authorityDigest);
  assert.equal(digestWithout(api.compilerAuthority, "authorityDigest"), api.compilerAuthority.authorityDigest);
  assert.equal(`sha256:${createHash("sha256").update(fs.readFileSync(path.join(REPOSITORY_ROOT, api.compilerAuthority.providerSourceRef))).digest("hex")}`, api.compilerAuthority.providerSourceDigest);
  assert.equal(digestWithout(api.fixtureManifest, "fixtureSetDigest"), api.fixtureManifest.fixtureSetDigest);
  assert.equal(api.profileAuthority.lifecycle, "ADMITTED");
  for (const fixture of api.fixtureManifest.fixtures) {
    const bytes = fs.readFileSync(path.join(FIXTURE_ROOT, fixture.path));
    assert.equal(`sha256:${createHash("sha256").update(bytes).digest("hex")}`, fixture.sourceDigest, fixture.fixtureId);
  }
});

test("exact Gherkin bytes, official AST, comments, dialects, diagnostics, and deterministic identities are preserved", async () => {
  const api = await subject();
  const fixtures = new Map(fixtureSources(api.fixtureManifest).map((fixture) => [fixture.fixtureId, fixture]));
  for (const fixtureId of ["basic-annotated-sda", "markdown-annotated-sda", "advanced-official-gherkin", "localized-french"]) {
    const request = parseRequest(api, fixtures.get(fixtureId));
    const first = api.parseCanonicalGherkin(request, api.grammarAuthority);
    const second = api.parseCanonicalGherkin(request, api.grammarAuthority);
    assert.deepEqual(second, first, fixtureId);
    assert.equal(first.disposition, "PARSED", fixtureId);
    assert.equal(first.source.sourceBytesBase64, request.sourceBytesBase64, fixtureId);
    assert.equal(first.source.sourceDigest, fixtures.get(fixtureId).sourceDigest, fixtureId);
    assert.ok(first.nodeIdentities.length > 0, fixtureId);
    assert.ok(first.nodeIdentities.every((node) => node.location.line > 0 && node.location.column > 0), fixtureId);
  }
  const advanced = api.parseCanonicalGherkin(parseRequest(api, fixtures.get("advanced-official-gherkin")), api.grammarAuthority);
  assert.equal(advanced.comments.length, 2);
  assert.match(advanced.gherkinDocument.feature.description, /narrative must remain distinct/);
  const french = api.parseCanonicalGherkin(parseRequest(api, fixtures.get("localized-french")), api.grammarAuthority);
  assert.equal(french.gherkinDocument.feature.language, "fr");

  const malformed = api.parseCanonicalGherkin(parseRequest(api, fixtures.get("malformed-syntax")), api.grammarAuthority);
  assert.equal(malformed.disposition, "REJECTED");
  assert.ok(malformed.diagnostics.some((finding) => finding.code === "GHERKIN_PARSE_ERROR"));
  assert.equal(malformed.source.sourceBytesBase64, fixtures.get("malformed-syntax").sourceBytesBase64);

  const mutations = [
    ["INVALID_SOURCE_BASE64", { sourceBytesBase64: "YQ" }],
    ["INVALID_UTF8", { sourceBytesBase64: "/w==" }],
    ["UNSUPPORTED_MEDIA_TYPE", { mediaType: "text/plain" }],
    ["UNSUPPORTED_DIALECT", { declaredDialect: "not-a-dialect" }],
    ["STALE_GRAMMAR_BINDING", { grammarBinding: { ...parseRequest(api, fixtures.get("basic-annotated-sda")).grammarBinding, providerAuthorityDigest: "sha256:stale" } }]
  ];
  const baseline = parseRequest(api, fixtures.get("basic-annotated-sda"));
  for (const [code, mutation] of mutations) {
    const result = api.parseCanonicalGherkin({ ...baseline, ...mutation }, api.grammarAuthority);
    assert.equal(result.disposition, "REJECTED", code);
    assert.ok(result.diagnostics.some((finding) => finding.code === code), code);
    assert.equal(result.gherkinDocument, null, code);
  }
  const fakeGrammar = structuredClone(api.grammarAuthority);
  fakeGrammar.packages[0].integrity = "sha512-ZmFrZQ==";
  fakeGrammar.authorityDigest = digestWithout(fakeGrammar, "authorityDigest");
  const fakeBinding = structuredClone(baseline);
  fakeBinding.grammarBinding.providerAuthorityDigest = fakeGrammar.authorityDigest;
  assert.equal(api.parseCanonicalGherkin(fakeBinding, fakeGrammar).diagnostics[0].code, "STALE_GRAMMAR_BINDING");
});

test("official cases retain deterministic AST and source lineage and reject drift", async () => {
  const api = await subject();
  const fixture = fixtureSources(api.fixtureManifest).find((item) => item.fixtureId === "advanced-official-gherkin");
  const parseEvidence = api.parseCanonicalGherkin(parseRequest(api, fixture), api.grammarAuthority);
  const request = compileRequest(api, parseEvidence);
  const first = api.compileCanonicalGherkinCases(request, api.grammarAuthority);
  const second = api.compileCanonicalGherkinCases(request, api.grammarAuthority);
  assert.deepEqual(second, first);
  assert.equal(first.disposition, "COMPILED");
  assert.equal(first.compiledCases.length, 2);
  assert.ok(first.compiledCases.every((gherkinCase) => gherkinCase.steps.some((step) => step.argument)));
  assert.ok(first.caseLineage.every((lineage) => lineage.astNodeIds.length > 0 && lineage.sourceLocations.length > 0));

  const staleParse = structuredClone(request);
  staleParse.parseEvidenceDigest = "sha256:" + "0".repeat(64);
  assert.equal(api.compileCanonicalGherkinCases(staleParse, api.grammarAuthority).diagnostics[0].code, "PARSE_EVIDENCE_DIGEST_MISMATCH");
  const staleGrammar = structuredClone(request);
  staleGrammar.grammarBindingDigest = "sha256:" + "1".repeat(64);
  assert.equal(api.compileCanonicalGherkinCases(staleGrammar, api.grammarAuthority).diagnostics[0].code, "GRAMMAR_BINDING_DIGEST_MISMATCH");

  const tamperedAst = structuredClone(parseEvidence);
  tamperedAst.gherkinDocument.feature.name = "Tampered after parse";
  const tamperedRequest = compileRequest(api, tamperedAst);
  assert.equal(api.compileCanonicalGherkinCases(tamperedRequest, api.grammarAuthority).diagnostics[0].code, "AST_DIGEST_MISMATCH");

  const otherFixture = fixtureSources(api.fixtureManifest).find((item) => item.fixtureId === "basic-annotated-sda");
  const otherParse = api.parseCanonicalGherkin(parseRequest(api, otherFixture), api.grammarAuthority);
  const recombined = structuredClone(parseEvidence);
  recombined.source = structuredClone(otherParse.source);
  recombined.nodeIdentities = bindNodeIdentitiesToSource(recombined);
  const recombinedRequest = compileRequest(api, recombined);
  assert.equal(api.compileCanonicalGherkinCases(recombinedRequest, api.grammarAuthority).diagnostics[0].code, "SOURCE_AST_REPRODUCTION_MISMATCH");
});

test("the SDA profile admits, holds, and rejects without losing grammar output or owner scope", async () => {
  const api = await subject();
  const fixtures = new Map(fixtureSources(api.fixtureManifest).map((fixture) => [fixture.fixtureId, fixture]));
  const evaluate = (fixtureId) => {
    const parseEvidence = api.parseCanonicalGherkin(parseRequest(api, fixtures.get(fixtureId)), api.grammarAuthority);
    const caseEvidence = api.compileCanonicalGherkinCases(compileRequest(api, parseEvidence), api.grammarAuthority);
    const admission = api.admitSdaAnnotatedGherkinProfile(admissionRequest(api, parseEvidence, caseEvidence));
    return { parseEvidence, caseEvidence, admission };
  };

  assert.equal(evaluate("basic-annotated-sda").admission.disposition, "PROFILE_ADMITTED");
  assert.equal(evaluate("advanced-official-gherkin").admission.disposition, "PROFILE_HELD");
  assert.equal(evaluate("localized-french").admission.disposition, "PROFILE_HELD");
  assert.ok(evaluate("advanced-official-gherkin").admission.diagnostics.every((finding) => finding.code === "PROFILE_CONSTRUCT_HELD"));
  assert.ok(evaluate("missing-required-sda-tag").admission.diagnostics.some((finding) => finding.code === "MISSING_REQUIRED_TAG"));
  assert.ok(evaluate("repeated-required-sda-tag").admission.diagnostics.some((finding) => finding.code === "REPEATED_REQUIRED_TAG"));
  assert.equal(evaluate("forbidden-semantic-tags").admission.diagnostics.filter((finding) => finding.code === "FORBIDDEN_SEMANTIC_CONTENT").length, 4);

  const owned = evaluate("owner-scoped-local-identities").admission;
  assert.equal(owned.disposition, "PROFILE_ADMITTED");
  assert.equal(owned.scenarioBindings.length, 2);
  assert.equal(owned.scenarioBindings[0].ownerScopedIdentities.input.localId, owned.scenarioBindings[1].ownerScopedIdentities.input.localId);
  assert.notEqual(owned.scenarioBindings[0].ownerScopedIdentities.input.semanticObjectId, owned.scenarioBindings[1].ownerScopedIdentities.input.semanticObjectId);
  assert.notEqual(owned.scenarioBindings[0].scenarioId, owned.scenarioBindings[1].scenarioId);

  const emptyIds = `@capability @root-scenario\nFeature: Empty identities\n\n  @scenario @input @input-contract @event @event-authority @outcome @outcome-contract\n  Scenario: Empty IDs\n    Given a source\n    When it is evaluated\n    Then it is rejected\n`;
  const emptyParse = api.parseCanonicalGherkin({
    ...parseRequest(api, fixtures.get("basic-annotated-sda")),
    sourceRef: "fixtures/empty-semantic-identities.feature",
    sourceBytesBase64: Buffer.from(emptyIds).toString("base64")
  }, api.grammarAuthority);
  const emptyCases = api.compileCanonicalGherkinCases(compileRequest(api, emptyParse), api.grammarAuthority);
  const emptyAdmission = api.admitSdaAnnotatedGherkinProfile(admissionRequest(api, emptyParse, emptyCases));
  assert.equal(emptyAdmission.disposition, "REJECTED");
  assert.ok(emptyAdmission.diagnostics.some((finding) => finding.code === "INVALID_SEMANTIC_ID"));
  assert.equal(emptyAdmission.featureIdentity, null);
  assert.deepEqual(emptyAdmission.scenarioBindings, []);

  const canonical = evaluate("basic-annotated-sda");
  const substitutedProfile = structuredClone(api.profileAuthority);
  substitutedProfile.commentsAreExecutableAuthority = true;
  const substitutedAdmission = api.admitSdaAnnotatedGherkinProfile({
    ...admissionRequest(api, canonical.parseEvidence, canonical.caseEvidence),
    profile: substitutedProfile,
    profileDigest: api.canonicalGherkinDigest(substitutedProfile)
  });
  assert.equal(substitutedAdmission.disposition, "REJECTED");
  assert.ok(substitutedAdmission.diagnostics.some((finding) => finding.code === "PROFILE_AUTHORITY_MISMATCH"));
});

test("binding emits immutable lineage with no projection or execution claims", async () => {
  const api = await subject();
  const fixture = fixtureSources(api.fixtureManifest).find((item) => item.fixtureId === "basic-annotated-sda");
  const parseEvidence = api.parseCanonicalGherkin(parseRequest(api, fixture), api.grammarAuthority);
  const caseEvidence = api.compileCanonicalGherkinCases(compileRequest(api, parseEvidence), api.grammarAuthority);
  const profileEvidence = api.admitSdaAnnotatedGherkinProfile(admissionRequest(api, parseEvidence, caseEvidence));
  const request = {
    contractId: "canonical-feature-compilation-binding-request.v1",
    parseEvidence,
    caseEvidence,
    profileEvidence,
    compilerAuthorityRef: api.compilerAuthority.authorityRef,
    compilerAuthorityDigest: api.compilerAuthority.authorityDigest
  };
  const authorities = { compilerAuthority: api.compilerAuthority, grammarAuthority: api.grammarAuthority, profileAuthority: api.profileAuthority };
  const first = api.bindCanonicalFeatureCompilation(request, authorities);
  assert.deepEqual(api.bindCanonicalFeatureCompilation(request, authorities), first);
  assert.equal(first.disposition, "BOUND");
  assert.deepEqual(first.authorityClaims, {
    projection: "NOT_CLAIMED",
    execution: "NOT_CLAIMED",
    behavioralConformance: "NOT_CLAIMED",
    companionClosure: "NOT_CLAIMED"
  });
  assert.equal(api.canonicalGherkinDigest({ ...first, compilationDigest: undefined }), first.compilationDigest);

  const inconsistent = structuredClone(request);
  inconsistent.profileEvidence.sourceDigest = "sha256:" + "0".repeat(64);
  assert.equal(api.bindCanonicalFeatureCompilation(inconsistent, authorities).disposition, "REJECTED");
  const tamperedCases = structuredClone(request);
  tamperedCases.caseEvidence.compiledCases[0].name = "Tampered case";
  tamperedCases.caseEvidence.caseDigest = api.canonicalGherkinDigest({ cases: tamperedCases.caseEvidence.compiledCases, lineage: tamperedCases.caseEvidence.caseLineage });
  tamperedCases.profileEvidence.caseDigest = tamperedCases.caseEvidence.caseDigest;
  tamperedCases.profileEvidence.admissionDigest = api.canonicalGherkinDigest({ ...tamperedCases.profileEvidence, admissionDigest: undefined });
  assert.equal(api.bindCanonicalFeatureCompilation(tamperedCases, authorities).disposition, "REJECTED");
  const stale = structuredClone(request);
  stale.compilerAuthorityRef = "canonical-gherkin-compiler.stale";
  assert.equal(api.bindCanonicalFeatureCompilation(stale, authorities).disposition, "STALE");
});

test("complete, missing-partition, and stale conformance inputs produce honest gate dispositions", async () => {
  const api = await subject();
  const authorities = {
    compilerAuthority: api.compilerAuthority,
    grammarAuthority: api.grammarAuthority,
    profileAuthority: api.profileAuthority
  };
  const request = conformanceRequest(api);
  const fixtures = fixtureSources(api.fixtureManifest);
  const complete = api.verifyGherkinCompilerConformance(request, authorities, api.fixtureManifest, fixtures);
  assert.equal(complete.disposition, "GHERKIN_SEMANTIC_INGESTION_CONFORMANT");
  assert.equal(complete.partitions.length, 12);
  assert.ok(complete.partitions.every((partition) => partition.disposition === "SATISFIED"));
  assert.deepEqual(complete.findings, []);
  assert.equal(api.canonicalGherkinDigest({ ...complete, receiptDigest: undefined }), complete.receiptDigest);
  assert.deepEqual(complete, json(path.join(CONFORMANCE_ROOT, "conformance", "gherkin-semantic-ingestion-conformance.v1.json")));

  const schema = json(path.join(CONFORMANCE_ROOT, "contracts", "gherkin-semantic-ingestion-conformance.v1.schema.json"));
  const validator = new Ajv2020({ strict: false });
  assert.equal(validator.validate(schema, complete), true, JSON.stringify(validator.errors, null, 2));

  const incompleteManifest = structuredClone(api.fixtureManifest);
  for (const fixture of incompleteManifest.fixtures) fixture.expectedProofPartitions = fixture.expectedProofPartitions.filter((partition) => partition !== "STEP_ARGUMENTS");
  incompleteManifest.fixtureSetDigest = digestWithout(incompleteManifest, "fixtureSetDigest");
  const incompleteRequest = structuredClone(request);
  incompleteRequest.fixtureCorpus.fixtureSetDigest = incompleteManifest.fixtureSetDigest;
  const open = api.verifyGherkinCompilerConformance(incompleteRequest, authorities, incompleteManifest, fixtureSources(incompleteManifest));
  assert.equal(open.disposition, "GHERKIN_SEMANTIC_INGESTION_OPEN");
  assert.equal(open.partitions.find((partition) => partition.partitionId === "STEP_ARGUMENTS").disposition, "NOT_OBSERVABLE");

  const staleAuthorities = structuredClone(authorities);
  staleAuthorities.compilerAuthority.rules.push("rule.unadmitted-mutation.v1");
  const stale = api.verifyGherkinCompilerConformance(request, staleAuthorities, api.fixtureManifest, fixtures);
  assert.equal(stale.disposition, "GHERKIN_SEMANTIC_INGESTION_REJECTED");
  assert.ok(stale.findings.some((finding) => finding.code === "STALE_COMPILER_AUTHORITY"));

  const substitutedAuthorities = structuredClone(authorities);
  substitutedAuthorities.compilerAuthority.providerSourceDigest = "sha256:" + "a".repeat(64);
  substitutedAuthorities.compilerAuthority.authorityDigest = digestWithout(substitutedAuthorities.compilerAuthority, "authorityDigest");
  const substituted = api.verifyGherkinCompilerConformance(
    { ...request, compilerAuthority: { ...request.compilerAuthority, authorityDigest: substitutedAuthorities.compilerAuthority.authorityDigest } },
    substitutedAuthorities,
    api.fixtureManifest,
    fixtures
  );
  assert.equal(substituted.disposition, "GHERKIN_SEMANTIC_INGESTION_REJECTED");
  assert.ok(substituted.findings.some((finding) => finding.code === "STALE_COMPILER_AUTHORITY"));

  const noMarkdownManifest = structuredClone(api.fixtureManifest);
  noMarkdownManifest.fixtures = noMarkdownManifest.fixtures.filter((fixture) => fixture.mediaType !== "text/x.cucumber.gherkin+markdown");
  noMarkdownManifest.fixtureSetDigest = digestWithout(noMarkdownManifest, "fixtureSetDigest");
  const noMarkdownRequest = structuredClone(request);
  noMarkdownRequest.fixtureCorpus.fixtureSetDigest = noMarkdownManifest.fixtureSetDigest;
  noMarkdownRequest.fixtureCorpus.fixtureDigests = noMarkdownManifest.fixtures.map((fixture) => fixture.sourceDigest);
  const noMarkdown = api.verifyGherkinCompilerConformance(noMarkdownRequest, authorities, noMarkdownManifest, fixtureSources(noMarkdownManifest));
  assert.equal(noMarkdown.disposition, "GHERKIN_SEMANTIC_INGESTION_REJECTED");
  assert.ok(noMarkdown.findings.some((finding) => finding.code === "INCOMPLETE_MEDIA_TYPE_COVERAGE"));

  const duplicateCarrierManifest = structuredClone(api.fixtureManifest);
  const invalidUtf8 = duplicateCarrierManifest.invalidCarrierCases.find((carrierCase) => carrierCase.mutation === "INVALID_UTF8");
  duplicateCarrierManifest.invalidCarrierCases = Array.from({ length: 5 }, (_, index) => ({ ...invalidUtf8, carrierCaseId: `duplicate-invalid-utf8-${index}` }));
  duplicateCarrierManifest.fixtureSetDigest = digestWithout(duplicateCarrierManifest, "fixtureSetDigest");
  const duplicateCarrierRequest = structuredClone(request);
  duplicateCarrierRequest.fixtureCorpus.fixtureSetDigest = duplicateCarrierManifest.fixtureSetDigest;
  const duplicateCarrier = api.verifyGherkinCompilerConformance(duplicateCarrierRequest, authorities, duplicateCarrierManifest, fixtures);
  assert.equal(duplicateCarrier.disposition, "GHERKIN_SEMANTIC_INGESTION_REJECTED");
  assert.ok(duplicateCarrier.findings.some((finding) => finding.code === "INVALID_CARRIER_EXPECTATION_MISMATCH"));

  const falseReorderingManifest = structuredClone(api.fixtureManifest);
  falseReorderingManifest.reproductionSets[0].discoveryOrders[1] = [...falseReorderingManifest.reproductionSets[0].discoveryOrders[0]];
  falseReorderingManifest.fixtureSetDigest = digestWithout(falseReorderingManifest, "fixtureSetDigest");
  const falseReorderingRequest = structuredClone(request);
  falseReorderingRequest.fixtureCorpus.fixtureSetDigest = falseReorderingManifest.fixtureSetDigest;
  const falseReordering = api.verifyGherkinCompilerConformance(falseReorderingRequest, authorities, falseReorderingManifest, fixtureSources(falseReorderingManifest));
  assert.equal(falseReordering.disposition, "GHERKIN_SEMANTIC_INGESTION_REJECTED");
  assert.equal(falseReordering.partitions.find((partition) => partition.partitionId === "REORDERED_REPRODUCTION").disposition, "NOT_SATISFIED");
});
