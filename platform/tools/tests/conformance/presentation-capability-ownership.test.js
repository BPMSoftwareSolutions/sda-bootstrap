"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const PACKAGE = path.join(ROOT, "capabilities", "sda-platform", "project-presentation-capabilities");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("ADR-0010 assigns presentation mechanics to projected capabilities", () => {
  assert.match(read("docs/decisions/0008-language-ecosystems-own-runtime-and-presentation-providers.md"), /Status: Superseded by ADR-0010/u);
  const decision = read("docs/decisions/0010-project-presentation-mechanics-as-capabilities.md");
  assert.match(decision, /Status: Accepted/u);
  assert.match(decision, /Language ecosystems resolve language, toolchain, packaging, and native API/u);
  assert.match(decision, /It may not author executable source or claim\s+admission/u);
});

test("the first projection batch has three fixed semantic capability identities", () => {
  const expected = [
    "project-activation-binding",
    "project-flow-composition",
    "project-semantic-element-realization"
  ];
  const features = fs.readdirSync(path.join(PACKAGE, "features")).sort();
  assert.deepEqual(features, expected.map((id) => `${id}.feature`));
  for (const capabilityId of expected) {
    const source = fs.readFileSync(path.join(PACKAGE, "features", `${capabilityId}.feature`), "utf8");
    assert.match(source, new RegExp(`@capability:${capabilityId}\\b`, "u"));
    assert.match(source, new RegExp(`@root-scenario:${capabilityId}\\b`, "u"));
    assert.doesNotMatch(source, /React|WPF|Avalonia|JavaFX|SwiftUI|Compose|AppKit|WinUI/iu);
  }
});

test("handwritten successor providers are frozen as oracles rather than relabeled projections", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE, "legacy-oracles.v1.json"), "utf8"));
  assert.equal(manifest.disposition, "FROZEN_PENDING_PROJECTED_EQUIVALENCE");
  for (const oracle of manifest.oracles) {
    const bytes = fs.readFileSync(path.join(ROOT, oracle.path));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), oracle.sha256, oracle.path);
    assert.match(oracle.path, /^languages\//u);
  }
});

test("the first harness candidate is held without admission when testimony retention and semantics fail", () => {
  const evidence = JSON.parse(fs.readFileSync(path.join(PACKAGE, "candidate-calibration", "project-semantic-element-realization-001.held.json"), "utf8"));
  assert.equal(evidence.resolvedModel, "gemini-flash-latest");
  assert.equal(evidence.attemptCount, 1);
  assert.equal(evidence.rawResponseRetention, "MISSING");
  assert.equal(evidence.disposition, "HELD");
  assert.equal(evidence.projectionDisposition, "NOT_ATTEMPTED");
  assert.equal(evidence.promotionDisposition, "NOT_ATTEMPTED");
  assert.ok(evidence.findings.some((finding) => finding.code === "SEMANTIC_KIND_VOCABULARY_INVENTED"));
  assert.deepEqual(new Set(Object.values(evidence.candidateClaims)), new Set(["NOT_CLAIMED", false]));
});

test("retained replacement testimony is rejected when SDA authority roots are invented", () => {
  const evidence = JSON.parse(fs.readFileSync(path.join(PACKAGE, "candidate-calibration", "project-semantic-element-realization-004.rejected.json"), "utf8"));
  assert.equal(evidence.resolvedModel, "gemini-flash-latest");
  assert.equal(evidence.attemptCount, 1);
  assert.equal(evidence.rawResponseRetention, "RETAINED");
  assert.equal(evidence.completeFixedSlotEnvelope, true);
  assert.deepEqual(evidence.semanticCoverage.projectionTargets, ["node", "python", "csharp"]);
  assert.equal(evidence.curationDisposition, "REGENERATION_REQUIRED");
  assert.equal(evidence.workbenchDisposition, "NOT_DERIVED");
  assert.equal(evidence.projectionDisposition, "NOT_ATTEMPTED");
  assert.equal(evidence.promotionDisposition, "NOT_ATTEMPTED");
  assert.equal(evidence.disposition, "REJECTED");
  assert.match(evidence.requestFileHash, /^sha256:[0-9a-f]{64}$/u);
  assert.match(evidence.responseFileHash, /^sha256:[0-9a-f]{64}$/u);
  assert.match(evidence.structuredCandidateHash, /^sha256:[0-9a-f]{64}$/u);
  assert.ok(evidence.findings.some((finding) => finding.code === "CAPABILITY_AUTHORITY_ROOT_INVENTED"));
});

test("provider unavailability remains execution testimony without a candidate claim", () => {
  const evidence = JSON.parse(fs.readFileSync(path.join(PACKAGE, "candidate-calibration", "project-semantic-element-realization-005.unavailable.json"), "utf8"));
  assert.equal(evidence.attemptCount, 1);
  assert.equal(evidence.providerDisposition, "PROVIDER_UNAVAILABLE");
  assert.equal(evidence.candidateProduced, false);
  assert.equal(evidence.admissionAttempted, false);
  assert.equal(evidence.projectionAttempted, false);
  assert.equal(evidence.promotionAttempted, false);
  assert.equal(evidence.disposition, "RETAINED_EXECUTION_TESTIMONY");
});

test("run 006 curation is hash-bound to every materialized authority document", () => {
  const receipt = JSON.parse(fs.readFileSync(path.join(PACKAGE, "candidate-calibration", "project-semantic-element-realization-006.curation.json"), "utf8"));
  const capabilityRoot = path.join(PACKAGE, "project-semantic-element-realization");
  assert.equal(receipt.resolvedModel, "gemini-flash-latest");
  assert.equal(receipt.attemptCount, 1);
  assert.equal(receipt.changedArtifacts.length, 11);
  assert.equal(receipt.unchangedArtifactCount, 0);
  for (const artifact of receipt.changedArtifacts) {
    const bytes = fs.readFileSync(path.join(capabilityRoot, artifact.logicalName));
    assert.equal(`sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`, artifact.curatedArtifactHash, artifact.logicalName);
    assert.match(artifact.sourceArtifactHash, /^sha256:[0-9a-f]{64}$/u);
    assert.ok(artifact.finding.length > 0);
    assert.ok(artifact.editOperation.length > 0);
  }
  assert.deepEqual(new Set(Object.values(receipt.claims)), new Set([
    "NOT_CLAIMED_BY_CURATION"
  ]));
  assert.equal(receipt.disposition, "CURATED_FOR_DETERMINISTIC_ADMISSION");
});

test("semantic element realization is projected-only and equivalent across Node, Python, and C#", () => {
  const capabilityRoot = path.join(PACKAGE, "project-semantic-element-realization");
  const projectedRoot = path.join(capabilityRoot, "projected");
  const evidence = JSON.parse(fs.readFileSync(path.join(capabilityRoot, "projection-evidence.v1.json"), "utf8"));
  const manifestBytes = fs.readFileSync(path.join(projectedRoot, "projection-manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(`sha256:${crypto.createHash("sha256").update(manifestBytes).digest("hex")}`, evidence.projectionManifestHash);
  assert.deepEqual(evidence.projectionTargets, ["node", "python", "csharp"]);
  assert.equal(evidence.executableOrigin, "PROJECTED_ONLY");
  assert.ok(manifest.files.length > 0);
  assert.ok(manifest.files.every((file) => file.executableOrigin === "PROJECTED"));
  for (const [target, relativePath] of Object.entries({
    node: "node/capability-runtime.generated.mjs",
    python: "python/consumer.generated.py",
    csharp: "csharp/Program.generated.cs"
  })) {
    const bytes = fs.readFileSync(path.join(projectedRoot, relativePath));
    assert.equal(`sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`, evidence.runtimeHashes[target]);
  }
  assert.equal(Object.keys(evidence.fixtureOutcomeHashes).length, 6);
  assert.equal(evidence.crossTargetDisposition, "EQUIVALENT");
  assert.equal(evidence.legacyOracleDisposition, "PENDING_NATIVE_REALIZATION_EQUIVALENCE");
  assert.equal(evidence.promotionDisposition, "NOT_PROMOTED");
});

test("native binding requirements are capability-owned observations rather than inferred semantics", async () => {
  const capabilityRoot = path.join(PACKAGE, "project-semantic-element-realization");
  const authority = JSON.parse(fs.readFileSync(path.join(capabilityRoot, "native-binding-requirements.authority.json"), "utf8"));
  const evidence = JSON.parse(fs.readFileSync(path.join(capabilityRoot, "native-equivalence-evidence.v1.json"), "utf8"));
  const expectedKinds = ["INFORMATION", "ACTION", "INPUT", "NAVIGATION", "FEEDBACK", "REGION"];
  assert.equal(authority.derivation.kind, "FROZEN_ORACLE_OBSERVATION");
  assert.equal(authority.derivation.semanticInferenceFromPhysicalStructure, false);
  assert.deepEqual(authority.semanticKinds, expectedKinds);
  assert.deepEqual(Object.keys(authority.targetProfiles).sort(), ["avalonia", "browser-dom-web", "react-web", "wpf"]);

  const plan = {
    planType: "ui-embodiment-plan.v1",
    canonicalDigest: "sha256:native-binding-observation",
    providerId: "frozen-oracle",
    providerDigest: "sha256:frozen-oracle",
    rootNodeRefs: ["root"],
    instructions: [
      ...expectedKinds.map((semanticKind, index) => ({
        instructionId: `element-${index}`,
        instructionKind: "REALIZE_SEMANTIC_ELEMENT",
        sourceRef: `element-${index}`,
        semanticKind,
        semanticRole: semanticKind.toLowerCase(),
        content: { kind: "LITERAL", value: semanticKind },
        stateRefs: []
      })),
      {
        instructionId: "root",
        instructionKind: "COMPOSE_NODE",
        sourceRef: "root",
        mechanicId: "layout.flow.v1",
        configuration: {},
        childNodeRefs: [],
        semanticElementRefs: expectedKinds.map((_, index) => `element-${index}`)
      }
    ]
  };
  const dom = await import("../../../languages/typescript/presentation/browser-dom/runtime/v3-plan-embodiment.mjs");
  const react = await import("../../../languages/typescript/presentation/react/runtime/v3-plan-embodiment.mjs");
  for (const [target, projection] of [
    ["browser-dom-web", dom.applyBrowserDomUiEmbodimentPlan(plan)],
    ["react-web", react.applyReactUiEmbodimentPlan(plan)]
  ]) {
    assert.deepEqual(
      Object.fromEntries(projection.elements.map((element) => [element.semanticKind, element.nativeRole])),
      authority.targetProfiles[target].nativeRoleBySemanticKind
    );
  }

  for (const target of ["wpf", "avalonia"]) {
    const source = read(`languages/csharp/src/ScenarioKernel.${target === "wpf" ? "Wpf" : "Avalonia"}/V3PlanEmbodiment.cs`);
    for (const [semanticKind, nativeRole] of Object.entries(authority.targetProfiles[target].nativeRoleBySemanticKind)) {
      if (["INFORMATION", "FEEDBACK"].includes(semanticKind)) continue;
      const expectedConstruction = nativeRole === "Border<TextBlock>" ? "new Border" : `new ${nativeRole}`;
      assert.match(source, new RegExp(`"${semanticKind}"\\s*=>\\s*${expectedConstruction}`, "u"), `${target}:${semanticKind}`);
    }
    assert.match(source, /_ => new TextBlock/u, `${target}:INFORMATION+FEEDBACK`);
  }

  assert.deepEqual(evidence.semanticProjection.languages, ["node", "python", "csharp"]);
  assert.equal(evidence.semanticProjection.disposition, "EQUIVALENT");
  assert.deepEqual(evidence.projectedNativeExecutables.map((item) => item.targetProfile), ["wpf"]);
  const wpfProjection = evidence.projectedNativeExecutables[0];
  const manifestBytes = fs.readFileSync(path.join(capabilityRoot, wpfProjection.projectionManifestRef));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(`sha256:${crypto.createHash("sha256").update(manifestBytes).digest("hex")}`, wpfProjection.projectionManifestHash);
  assert.equal(wpfProjection.origin, "PROJECTED_ONLY");
  assert.equal(wpfProjection.oracleEquivalence, "EQUIVALENT");
  assert.equal(manifest.targetProfile, "wpf");
  assert.ok(manifest.files.every((file) => file.executableOrigin === "PROJECTED"));
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(path.join(capabilityRoot, "projected", "wpf", file.path));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), file.sha256, file.path);
    if (/\.(?:cs|csproj)$/u.test(file.path)) assert.match(bytes.toString("utf8"), /GENERATED|<Project/u, file.path);
  }
  assert.equal(evidence.nativeRealizationDisposition, "WPF_ELEMENT_REALIZATION_EQUIVALENT_OTHER_TARGETS_OPEN");
  assert.equal(evidence.legacyOracleDisposition, "RETAIN_FROZEN");
  assert.equal(evidence.promotionDisposition, "NOT_PROMOTED");
});
