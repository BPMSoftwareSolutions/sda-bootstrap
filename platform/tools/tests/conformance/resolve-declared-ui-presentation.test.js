"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "resolve-declared-ui-presentation");
const CONTRACTS_ROOT = path.join(PACKAGE_ROOT, "contracts");
const FIXTURES_ROOT = path.join(PACKAGE_ROOT, "fixtures");

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_ROOT, `${name}.declared-ui-authority.json`), "utf8"));
}

async function modules() {
  const resolver = await import("../../../artifacts/tools/dist/ui-presentation/application/declared-ui-presentation-resolver.js");
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  return { ...resolver, admission: new AjvSchemaAdmission(CONTRACTS_ROOT) };
}

test("the semantic presentation package is closed and target-neutral", async () => {
  const { admission } = await modules();
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  assert.deepEqual(admission.listSchemaFiles(), [
    "declared-ui-authority.v1.schema.json",
    "declared-ui-source-admission-evidence.v1.schema.json",
    "presentation-closure-evidence.v1.schema.json",
    "resolve-declared-ui-presentation.authority.schema.json",
    "sda-ui-semantic-presentation.v1.schema.json",
    "semantic-presentation-lineage-evidence.v1.schema.json",
    "semantic-presentation-resolution-evidence.v1.schema.json"
  ]);
  const packageText = admission.listSchemaFiles()
    .map((name) => fs.readFileSync(path.join(CONTRACTS_ROOT, name), "utf8"))
    .join("\n");
  assert.doesNotMatch(packageText, /\b(?:react|wpf|xaml|css|html|javafx|swiftui|compose|appkit|winui|avalonia|qt|fyne|grid\.column|display:flex|vstack|dockpanel|borderpane)\b/iu);
  assert.doesNotMatch(
    fs.readFileSync(path.join(REPOSITORY_ROOT, "tools", "src", "ui-presentation", "application", "declared-ui-presentation-resolver.ts"), "utf8"),
    /\b(?:react|wpf|xaml|css|html|javafx|swiftui|compose|appkit|winui|avalonia|qt|fyne)\b/iu
  );
  const eventAuthority = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "resolve-declared-ui-presentation.authority.json"), "utf8"));
  assert.equal(admission.validate(eventAuthority, "resolve-declared-ui-presentation.authority.schema.json").valid, true);
});

test("an empty declaration produces the canonical zero-opinion presentation", async () => {
  const { admission, executeDeclaredUiPresentationResolution, resolveDeclaredUiPresentation, semanticPresentationDigest } = await modules();
  const authority = fixture("empty");
  assert.equal(admission.validate(authority, "declared-ui-authority.v1.schema.json").valid, true);
  const result = resolveDeclaredUiPresentation(authority);
  assert.equal(admission.validate(result.presentation, "sda-ui-semantic-presentation.v1.schema.json").valid, true);
  assert.equal(admission.validate(result.lineageEvidence, "semantic-presentation-lineage-evidence.v1.schema.json").valid, true);
  assert.equal(admission.validate(result.closureEvidence, "presentation-closure-evidence.v1.schema.json").valid, true);
  assert.deepEqual(result.presentation.elements, []);
  assert.deepEqual(result.presentation.relationships, []);
  assert.deepEqual(result.presentation.adaptationIntents, []);
  assert.deepEqual(result.presentation.presentationProfileRefs, []);
  assert.equal(result.presentation.canonicalDigest, semanticPresentationDigest(result.presentation));
  assert.deepEqual(result.closureEvidence.zeroOpinionCounts, {
    visibleElements: 0,
    interactions: 0,
    stylingDecisions: 0,
    implicitActions: 0,
    implicitLayouts: 0,
    defaultPresentationProfiles: 0
  });
  assert.equal(result.closureEvidence.disposition, "VALID_EMPTY_PRESENTATION");
  const execution = executeDeclaredUiPresentationResolution(authority);
  assert.equal(execution.admissionEvidence.disposition, "ADMITTED");
  assert.equal(execution.resolutionEvidence.disposition, "RESOLVED");
  assert.equal(admission.validate(execution.admissionEvidence, "declared-ui-source-admission-evidence.v1.schema.json").valid, true);
  assert.equal(admission.validate(execution.resolutionEvidence, "semantic-presentation-resolution-evidence.v1.schema.json").valid, true);
  assert.deepEqual(execution.resolutionEvidence.stages.map((stage) => stage.disposition), Array(8).fill("PASS"));
});

test("the minimal semantic corpus resolves deterministically without a visual profile", async () => {
  const { admission, executeDeclaredUiPresentationResolution, resolveDeclaredUiPresentation } = await modules();
  const authority = fixture("minimal");
  assert.equal(admission.validate(authority, "declared-ui-authority.v1.schema.json").valid, true);
  const first = resolveDeclaredUiPresentation(authority);
  const reordered = structuredClone(authority);
  reordered.elements.reverse();
  reordered.elements.forEach((element) => {
    element.informationRefs.reverse();
    element.interactionRefs.reverse();
    element.feedbackRefs.reverse();
    element.stateRefs.reverse();
    element.eventRefs.reverse();
    element.accessibilityObligations.reverse();
    element.lineage.reverse();
  });
  reordered.relationships.reverse();
  reordered.adaptationIntents.reverse();
  reordered.adaptationIntents.forEach((intent) => {
    intent.allowedChangeKinds.reverse();
    intent.invariantRefs.reverse();
  });
  const second = resolveDeclaredUiPresentation(reordered);
  assert.deepEqual(second, first);
  assert.equal(first.lineageEvidence.disposition, "ADMITTED");
  assert.equal(first.closureEvidence.disposition, "CLOSED");
  assert.deepEqual(first.presentation.presentationProfileRefs, []);
  assert.equal(first.presentation.elements.length, 3);
  assert.equal(first.closureEvidence.zeroOpinionCounts.interactions, 1);
  assert.equal(admission.validate(first.presentation, "sda-ui-semantic-presentation.v1.schema.json").valid, true);
  const execution = executeDeclaredUiPresentationResolution(authority);
  assert.equal(execution.resolutionEvidence.disposition, "RESOLVED");
  assert.equal(execution.resolutionEvidence.presentationDigest, first.presentation.canonicalDigest);
  assert.deepEqual(execution.resolutionEvidence.stages.map((stage) => stage.stageId), [
    "admit-declared-ui",
    "resolve-ui-presentation-lineage",
    "reject-unjustified-presentation",
    "resolve-semantic-presentation-composition",
    "resolve-semantic-interaction-presentation",
    "resolve-adaptive-presentation",
    "resolve-declared-presentation-profile",
    "produce-canonical-semantic-presentation"
  ]);
});

test("deleting authority removes its semantic surface and lineage", async () => {
  const { admission, resolveDeclaredUiPresentation } = await modules();
  const deletion = fixture("deletion");
  assert.equal(admission.validate(deletion, "declared-ui-authority.v1.schema.json").valid, true);
  const result = resolveDeclaredUiPresentation(deletion);
  assert.deepEqual(result.presentation.elements.map((element) => element.elementId), ["information.result"]);
  assert.deepEqual(result.presentation.relationships, []);
  assert.equal(result.lineageEvidence.elementResults.some((item) => item.subjectId === "action.resolve"), false);
  assert.equal(result.lineageEvidence.elementResults.some((item) => item.subjectId === "feedback.resolution-status"), false);
  assert.equal(result.closureEvidence.disposition, "CLOSED");
});

test("observable experience and unjustified-surface mutations fail with canonical findings", async () => {
  const { admission, resolveDeclaredUiPresentation } = await modules();
  const missing = fixture("missing-presentation");
  assert.equal(admission.validate(missing, "declared-ui-authority.v1.schema.json").valid, true);
  const missingResult = resolveDeclaredUiPresentation(missing);
  assert.equal(missingResult.closureEvidence.disposition, "REJECTED");
  assert.deepEqual(missingResult.closureEvidence.findings, [{
    code: "MISSING_PRESENTATION_FOR_EXPERIENCE",
    subjectRef: "experience.requires-observable-ui"
  }]);

  const unrelatedSurface = fixture("minimal");
  unrelatedSurface.promisedExperiences[0].experienceRef = "experience.not-in-element-lineage";
  const unrelatedResult = resolveDeclaredUiPresentation(unrelatedSurface);
  assert.equal(unrelatedResult.closureEvidence.disposition, "REJECTED");
  assert.deepEqual(unrelatedResult.closureEvidence.findings, [{
    code: "MISSING_PRESENTATION_FOR_EXPERIENCE",
    subjectRef: "experience.not-in-element-lineage"
  }]);

  const unjustified = fixture("unjustified-surface");
  assert.equal(admission.validate(unjustified, "declared-ui-authority.v1.schema.json").valid, true);
  const unjustifiedResult = resolveDeclaredUiPresentation(unjustified);
  assert.equal(admission.validate(unjustifiedResult.presentation, "sda-ui-semantic-presentation.v1.schema.json").valid, false);
  assert.equal(unjustifiedResult.lineageEvidence.disposition, "REJECTED");
  assert.deepEqual(unjustifiedResult.lineageEvidence.findings, [{
    code: "UNJUSTIFIED_PRESENTATION_ELEMENT",
    subjectRef: "region.invented-shell"
  }]);
  assert.equal(unjustifiedResult.closureEvidence.disposition, "REJECTED");
});

test("source admission and every semantic child stage fail deterministically", async () => {
  const { admission, declaredUiAuthorityDigest, executeDeclaredUiPresentationResolution } = await modules();

  const stale = fixture("minimal");
  stale.elements[0].semanticRole = "SUPPORTING";
  const staleResult = executeDeclaredUiPresentationResolution(stale);
  assert.equal(staleResult.admissionEvidence.disposition, "REJECTED");
  assert.deepEqual(staleResult.resolutionEvidence.findings, [{
    code: "DECLARED_UI_AUTHORITY_DIGEST_MISMATCH",
    subjectRef: "fixture.minimal-ui"
  }]);
  assert.deepEqual(staleResult.resolutionEvidence.stages.map((stage) => stage.disposition), [
    "FAIL", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED", "NOT_REACHED"
  ]);
  assert.equal(admission.validate(staleResult.admissionEvidence, "declared-ui-source-admission-evidence.v1.schema.json").valid, true);
  assert.equal(admission.validate(staleResult.resolutionEvidence, "semantic-presentation-resolution-evidence.v1.schema.json").valid, true);

  const duplicate = fixture("minimal");
  duplicate.elements.push(structuredClone(duplicate.elements[0]));
  duplicate.authorityDigest = declaredUiAuthorityDigest(duplicate);
  const duplicateResult = executeDeclaredUiPresentationResolution(duplicate);
  assert.deepEqual(duplicateResult.resolutionEvidence.findings, [{
    code: "DUPLICATE_SEMANTIC_ELEMENT",
    subjectRef: "information.result"
  }]);

  const composition = fixture("minimal");
  composition.relationships[0].targetElementId = "feedback.unknown";
  composition.authorityDigest = declaredUiAuthorityDigest(composition);
  const compositionResult = executeDeclaredUiPresentationResolution(composition);
  assert.equal(compositionResult.resolutionEvidence.stages[3].disposition, "FAIL");
  assert.ok(compositionResult.resolutionEvidence.findings.some((finding) => finding.code === "UNKNOWN_RELATIONSHIP_ENDPOINT"));

  const interaction = fixture("minimal");
  interaction.elements.find((element) => element.elementId === "action.resolve").eventRefs = [];
  interaction.authorityDigest = declaredUiAuthorityDigest(interaction);
  const interactionResult = executeDeclaredUiPresentationResolution(interaction);
  assert.equal(interactionResult.resolutionEvidence.stages[4].disposition, "FAIL");
  assert.ok(interactionResult.resolutionEvidence.findings.some((finding) => finding.code === "MISSING_INTERACTION_PRESENTATION"));

  const adaptation = fixture("minimal");
  adaptation.adaptationIntents[0].invariantRefs = ["experience.unknown"];
  adaptation.authorityDigest = declaredUiAuthorityDigest(adaptation);
  const adaptationResult = executeDeclaredUiPresentationResolution(adaptation);
  assert.equal(adaptationResult.resolutionEvidence.stages[5].disposition, "FAIL");
  assert.ok(adaptationResult.resolutionEvidence.findings.some((finding) => finding.code === "UNKNOWN_ADAPTATION_INVARIANT"));

  const unjustified = fixture("unjustified-surface");
  const unjustifiedResult = executeDeclaredUiPresentationResolution(unjustified);
  assert.equal(unjustifiedResult.resolutionEvidence.stages[1].disposition, "FAIL");
  assert.equal(unjustifiedResult.resolutionEvidence.stages[2].disposition, "FAIL");
  assert.equal(unjustifiedResult.resolutionEvidence.disposition, "REJECTED");
});
