"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "import-legacy-ui-presentation");
const COMPILER_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "compile-semantic-presentation");

function json(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8"));
}

function pointer(document, pointer) {
  return pointer.split("/").slice(1).reduce((value, token) => value[token.replaceAll("~1", "/").replaceAll("~0", "~")], document);
}

function targetRef(source, candidate) {
  const value = pointer(source, candidate.sourcePath);
  if (candidate.candidateKind === "PROMISED_EXPERIENCE") return value.conditionId;
  if (candidate.candidateKind === "PRESENTATION_PROFILE") return value;
  return value.refId ?? value.informationId ?? value.inputId ?? value.actionId ?? value.collectionId ?? value.feedbackId ?? value.navigationId;
}

function declaredAuthorityFromV1(source, sourceDigest, declaredUiAuthorityDigest) {
  const interaction = source.interactionAuthority;
  const promises = source.experienceAuthority.conditions.map((condition) => condition.conditionId);
  const lineage = (originType, originRef) => [
    { originType, originRef, authorityDigest: sourceDigest },
    ...promises.map((experienceRef) => ({ originType: "PROMISED_EXPERIENCE", originRef: experienceRef, authorityDigest: sourceDigest }))
  ];
  function element(item, semanticKind, semanticRole, idKey, originType) {
    const elementId = item[idKey];
    const obligations = [];
    if (item.accessibility?.name) obligations.push({ obligationRef: `accessibility.${elementId}.name`, kind: "NAME" });
    if (item.accessibility?.live && item.accessibility.live !== "off") obligations.push({ obligationRef: `accessibility.${elementId}.live`, kind: "LIVE_FEEDBACK" });
    if (semanticKind === "ACTION") obligations.push({ obligationRef: `accessibility.${elementId}.operable`, kind: "OPERABLE_ACTION" });
    const base = {
      elementId,
      semanticKind,
      semanticRole,
      informationRefs: semanticKind === "INFORMATION" ? [elementId] : [],
      interactionRefs: semanticKind === "ACTION" ? [item.operationId] : semanticKind === "INPUT" || semanticKind === "NAVIGATION" ? [elementId] : [],
      feedbackRefs: semanticKind === "FEEDBACK" ? [elementId] : [],
      stateRefs: item.stateId ? [item.stateId] : [],
      eventRefs: semanticKind === "ACTION" ? [`event.action.${elementId}`] : semanticKind === "INPUT" ? [`event.input.${elementId}`] : semanticKind === "NAVIGATION" ? [`event.navigation.${elementId}`] : [],
      accessibilityObligations: obligations,
      lineage: lineage(originType, elementId)
    };
    const content = item.content ?? item.label ?? item.title;
    return content ? { ...base, content: { literal: content } } : base;
  }
  const elements = [
    ...interaction.information.map((item) => element(item, "INFORMATION", "SUPPORTING", "informationId", "INFORMATION")),
    ...interaction.inputs.map((item) => element(item, "INPUT", "PRIMARY", "inputId", "INTERACTION")),
    ...interaction.actions.map((item) => element(item, "ACTION", "PRIMARY", "actionId", "INTERACTION")),
    ...interaction.collections.map((item) => element(item, "REGION", "GROUP", "collectionId", "INFORMATION")),
    ...interaction.feedback.map((item) => element(item, "FEEDBACK", "STATUS", "feedbackId", "FEEDBACK")),
    ...interaction.navigation.map((item) => element(item, "NAVIGATION", "NAVIGATION", "navigationId", "INTERACTION"))
  ];
  const withoutDigest = {
    authorityType: "declared-ui-authority.v1",
    authorityId: `legacy.${source.applicationId}`,
    promisedExperiences: promises.map((experienceRef) => ({ experienceRef, presentationRequirement: "OBSERVABLE_OR_OPERABLE" })),
    elements,
    relationships: [],
    adaptationIntents: [],
    presentationProfileRefs: [source.presentationProfile.profileId]
  };
  const authority = { ...withoutDigest, authorityDigest: "sha256:" + "0".repeat(64) };
  authority.authorityDigest = declaredUiAuthorityDigest(authority);
  return authority;
}

function manifestFor(source, authority, api) {
  const inspection = api.inspectLegacyUiFacts(source);
  const withoutDigest = {
    manifestType: "legacy-ui-semantic-origin-manifest.v1",
    manifestId: `repair.${inspection.sourceType.replaceAll(".", "-")}`,
    sourceType: inspection.sourceType,
    sourceDigest: inspection.sourceDigest,
    declaredAuthorityDigest: authority.authorityDigest,
    factMappings: inspection.semanticCandidates.map((candidate) => ({
      sourcePath: candidate.sourcePath,
      targetKind: candidate.candidateKind,
      targetRef: targetRef(source, candidate)
    }))
  };
  const manifest = { ...withoutDigest, manifestDigest: "sha256:" + "0".repeat(64) };
  manifest.manifestDigest = api.legacyOriginManifestDigest(manifest);
  return manifest;
}

async function subject() {
  const api = await import("../../../artifacts/tools/dist/ui-presentation/application/legacy-ui-compatibility-compiler.js");
  const resolver = await import("../../../artifacts/tools/dist/ui-presentation/application/declared-ui-presentation-resolver.js");
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  return {
    ...api,
    ...resolver,
    admission: new AjvSchemaAdmission(path.join(PACKAGE_ROOT, "contracts")),
    legacyAdmission: new AjvSchemaAdmission(path.join(REPOSITORY_ROOT, "kernel", "schemas")),
    compilerAuthority: json("capabilities/sda-platform/compile-semantic-presentation/compile-semantic-presentation.authority.json")
  };
}

test("Phase G contracts are closed and the source contains no physical-to-semantic inference vocabulary", async () => {
  const api = await subject();
  assert.deepEqual(api.admission.unresolvedSchemaFiles(), []);
  const source = fs.readFileSync(path.join(REPOSITORY_ROOT, "tools", "src", "ui-presentation", "application", "legacy-ui-compatibility-compiler.ts"), "utf8");
  assert.doesNotMatch(source, /(?:sidebar.*navigation|green.*success|font.*importance|coordinate.*semantic|control.*semantic)/iu);
});

test("unrepaired v1 produces deterministic unresolved evidence and an editable lineage-bound workbench", async () => {
  const api = await subject();
  const legacy = json("examples/generic-capability/ui.authority.json");
  assert.equal(api.legacyAdmission.validate(legacy, "consumer-ui-authority.schema.json").valid, true);
  const first = api.importLegacyUiPresentation(legacy);
  const second = api.importLegacyUiPresentation(structuredClone(legacy));
  assert.deepEqual(second, first);
  assert.equal(first.evidence.disposition, "SEMANTIC_ORIGIN_UNRESOLVED");
  assert.ok(first.workbench.unresolvedFacts.length > 0);
  assert.ok(first.workbench.preservedLegacyFacts.some((item) => item.factClass === "VISUAL_PRESENTATION"));
  assert.ok(first.workbench.preservedLegacyFacts.some((item) => item.factClass === "TARGET_RECIPE"));
  assert.equal(api.legacyRepairWorkbenchDigest(first.workbench), first.workbench.canonicalDigest);
  assert.equal(api.admission.validate(first.evidence, "legacy-ui-compatibility-evidence.v1.schema.json").valid, true);
  assert.equal(api.admission.validate(first.workbench, "legacy-ui-repair-workbench.v1.schema.json").valid, true);
});

test("explicit repair converts frozen v1 and v2 through the same semantic presentation and successor IR", async () => {
  const api = await subject();
  const legacyV1 = json("examples/generic-capability/ui.authority.json");
  const authority = declaredAuthorityFromV1(legacyV1, api.legacySourceDigest(legacyV1), api.declaredUiAuthorityDigest);
  const v1Manifest = manifestFor(legacyV1, authority, api);
  assert.equal(api.admission.validate(v1Manifest, "legacy-ui-semantic-origin-manifest.v1.schema.json").valid, true);
  const v1 = api.importLegacyUiPresentation(legacyV1, { manifest: v1Manifest, declaredAuthority: authority }, api.compilerAuthority);
  assert.equal(v1.evidence.disposition, "ADMITTED_WITH_LEGACY_PRESENTATION_FACTS");
  assert.equal(v1.evidence.semanticPresentationDigest, v1.presentation.canonicalDigest);
  assert.equal(v1.evidence.successorIrDigest, v1.ir.canonicalDigest);

  const { UiPresentationCompiler } = await import("../../../artifacts/tools/dist/ui-parity/application/ui-presentation-compiler.js");
  const legacyV2 = new UiPresentationCompiler(REPOSITORY_ROOT).compile(legacyV1).ir;
  const v2Manifest = manifestFor(legacyV2, authority, api);
  const v2 = api.importLegacyUiPresentation(legacyV2, { manifest: v2Manifest, declaredAuthority: authority }, api.compilerAuthority);
  assert.equal(v2.evidence.disposition, "ADMITTED_WITH_LEGACY_PRESENTATION_FACTS");
  assert.equal(v2.presentation.canonicalDigest, v1.presentation.canonicalDigest);
  assert.equal(v2.ir.canonicalDigest, v1.ir.canonicalDigest);
  assert.equal(api.admission.validate(v1.evidence, "legacy-ui-compatibility-evidence.v1.schema.json").valid, true);
  assert.equal(api.admission.validate(v2.evidence, "legacy-ui-compatibility-evidence.v1.schema.json").valid, true);
});

test("physical and visual mutations never change repaired semantics", async () => {
  const api = await subject();
  const base = json("examples/generic-capability/ui.authority.json");
  const sourceDigest = api.legacySourceDigest(base);
  const authority = declaredAuthorityFromV1(base, sourceDigest, api.declaredUiAuthorityDigest);
  const baseResult = api.importLegacyUiPresentation(base, { manifest: manifestFor(base, authority, api), declaredAuthority: authority }, api.compilerAuthority);

  const mutation = structuredClone(base);
  mutation.presentationProfile.tokens.colors.primaryAction = "#abcdef";
  mutation.presentationProfile.views[0].layoutIntent = "column";
  mutation.presentationProfile.views[0].regions[0].layoutIntent = "stack";
  mutation.presentationProfile.intent.experiencePattern = "assurance-workspace";
  assert.equal(api.legacyAdmission.validate(mutation, "consumer-ui-authority.schema.json").valid, true);
  const mutatedResult = api.importLegacyUiPresentation(mutation, { manifest: manifestFor(mutation, authority, api), declaredAuthority: authority }, api.compilerAuthority);
  assert.equal(mutatedResult.presentation.canonicalDigest, baseResult.presentation.canonicalDigest);
  assert.equal(mutatedResult.ir.canonicalDigest, baseResult.ir.canonicalDigest);
  assert.notDeepEqual(
    mutatedResult.evidence.factResults.filter((item) => item.factClass !== "SEMANTIC"),
    baseResult.evidence.factResults.filter((item) => item.factClass !== "SEMANTIC")
  );
});

test("stale manifests, unknown targets, and unsupported sources are incompatible", async () => {
  const api = await subject();
  const legacy = json("examples/generic-capability/ui.authority.json");
  const authority = declaredAuthorityFromV1(legacy, api.legacySourceDigest(legacy), api.declaredUiAuthorityDigest);
  const stale = manifestFor(legacy, authority, api);
  stale.sourceDigest = "sha256:" + "f".repeat(64);
  const staleResult = api.importLegacyUiPresentation(legacy, { manifest: stale, declaredAuthority: authority }, api.compilerAuthority);
  assert.equal(staleResult.evidence.disposition, "INCOMPATIBLE");
  assert.ok(staleResult.evidence.findings.some((item) => item.code === "LEGACY_SOURCE_DIGEST_MISMATCH"));

  const incomplete = manifestFor(legacy, authority, api);
  incomplete.factMappings.pop();
  incomplete.manifestDigest = api.legacyOriginManifestDigest(incomplete);
  const incompleteResult = api.importLegacyUiPresentation(legacy, { manifest: incomplete, declaredAuthority: authority }, api.compilerAuthority);
  assert.equal(incompleteResult.evidence.disposition, "SEMANTIC_ORIGIN_UNRESOLVED");
  assert.equal(incompleteResult.workbench.unresolvedFacts.length, 1);

  const duplicate = manifestFor(legacy, authority, api);
  duplicate.factMappings.push(structuredClone(duplicate.factMappings[0]));
  duplicate.manifestDigest = api.legacyOriginManifestDigest(duplicate);
  const duplicateResult = api.importLegacyUiPresentation(legacy, { manifest: duplicate, declaredAuthority: authority }, api.compilerAuthority);
  assert.equal(duplicateResult.evidence.disposition, "INCOMPATIBLE");
  assert.ok(duplicateResult.evidence.findings.some((item) => item.code === "DUPLICATE_FACT_MAPPING"));

  const invalidAuthority = structuredClone(authority);
  invalidAuthority.elements.find((item) => item.semanticKind === "ACTION").eventRefs = [];
  invalidAuthority.authorityDigest = api.declaredUiAuthorityDigest(invalidAuthority);
  const invalidAuthorityManifest = manifestFor(legacy, invalidAuthority, api);
  const invalidAuthorityResult = api.importLegacyUiPresentation(
    legacy,
    { manifest: invalidAuthorityManifest, declaredAuthority: invalidAuthority },
    api.compilerAuthority
  );
  assert.equal(invalidAuthorityResult.evidence.disposition, "INCOMPATIBLE");
  assert.ok(invalidAuthorityResult.evidence.findings.some((item) => item.code === "DECLARED_AUTHORITY_REJECTED"));

  const staleCompiler = structuredClone(api.compilerAuthority);
  staleCompiler.defaultComposition.axis = "INLINE";
  const compilerRejected = api.importLegacyUiPresentation(
    legacy,
    { manifest: manifestFor(legacy, authority, api), declaredAuthority: authority },
    staleCompiler
  );
  assert.equal(compilerRejected.evidence.disposition, "INCOMPATIBLE");
  assert.ok(compilerRejected.evidence.findings.some((item) => item.code === "SUCCESSOR_COMPILATION_REJECTED"));

  const unsupported = api.importLegacyUiPresentation({ presentationIrType: "invented.v9" });
  assert.equal(unsupported.evidence.disposition, "INCOMPATIBLE");
  assert.deepEqual(unsupported.evidence.findings, [{ code: "UNSUPPORTED_LEGACY_SOURCE", subjectRef: "legacy-source" }]);
});
