"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");

const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const WORKSPACE_ROOT = createReferenceWorkspace();
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");
const { projectUiParity } = require("../../../artifacts/tools/dist/interfaces/ui-parity/project.js");
const { ConsumerAssuranceService } = require("../../../artifacts/tools/dist/consumer-projection/application/consumer-assurance-service.js");
const { UiParityEvaluator } = require("../../../artifacts/tools/dist/ui-parity/proof/ui-parity-evaluator.js");
const { canonicalDigest, createUiAuthorityIdentity } = require("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
const { admitUiClaimantImplementation } = require("../../../artifacts/tools/dist/ui-parity/proof/claimant-implementation-admission.js");
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, relativePath), "utf8"));
}

function readFrom(workspaceRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8"));
}

function observations(step) {
  const value = { information: [], availability: [], validation: [], state: [], feedback: [], navigation: [], accessibility: [] };
  if (step.action === "observe") value[step.dimension].push({ target: step.target, value: `${step.dimension}:${step.target}` });
  return value;
}

function testimony(target, identity, vectors) {
  return {
    testimonyType: "consumer-ui-testimony.v1",
    applicationId: identity.applicationId,
    embodimentTarget: target,
    authorityDigest: identity.authorityDigest,
    vectorCorpusDigest: canonicalDigest(vectors),
    executableOrigin: "PROJECTED_ONLY",
    vectorResults: vectors.vectors.map((vector) => ({
      vectorId: vector.vectorId,
      interactionDisposition: vector.expectedDisposition,
      steps: vector.steps.map((step) => ({
        stepId: step.stepId,
        semanticAction: step.action,
        target: step.target,
        interactionDisposition: step.action === "invoke-action" && vector.expectedDisposition !== "COMPLETED"
          ? vector.expectedDisposition : "COMPLETED",
        observations: observations(step)
      }))
    }))
  };
}

function wiring(target, authority, identity) {
  const requiredInteractions = [
    ...authority.interactionAuthority.inputs.map((item) => ({ semanticKind: "input", refId: item.inputId })),
    ...authority.interactionAuthority.actions.map((item) => ({ semanticKind: "action", refId: item.actionId }))
  ];
  return {
    wiringConformanceType: "consumer-ui-wiring-conformance.v1",
    applicationId: identity.applicationId,
    embodimentTarget: target,
    authorityDigest: identity.authorityDigest,
    requiredInteractions,
    realizedInteractions: requiredInteractions.map((item) => ({
      ...item,
      nativeRole: item.semanticKind === "action" ? "button" : "textbox",
      nativeLocator: `${target}:${item.semanticKind}:${item.refId}`
    })),
    unboundRequiredInteractions: [],
    inventedInteractions: [],
    disposition: "PASS"
  };
}

function presentation(target, authority, identity) {
  const profile = authority.presentationProfile;
  const observations = [
    ["hierarchy", "application-hierarchy", profile.intent.hierarchy],
    ["typography", "application-typography", profile.tokens.typography],
    ["spacing-density", "application-density", { density: profile.density, spacing: profile.tokens.spacing }],
    ["state-distinction", "application-states", profile.intent.stateDistinction],
    ["responsive-adaptive", "application-adaptation", profile.adaptation],
    ["focus", "application-focus", profile.intent.focus],
    ["media", "application-media", profile.intent.media],
    ["motion", "application-motion", profile.intent.motion],
    ["platform-adaptation", "application-native-embodiment", profile.intent.platformAdaptation],
    ...profile.views.flatMap((view) => view.regions.flatMap((region) => [
      ["grouping", region.regionId, region.layoutIntent],
      ["surface", region.regionId, profile.intent.surfaces.region]
    ])),
    ...authority.interactionAuthority.actions.map((action) => ["action-emphasis", action.actionId, profile.intent.actionEmphasis[action.importance]]),
    ...authority.interactionAuthority.feedback.map((feedback) => ["surface", feedback.feedbackId, profile.intent.surfaces[feedback.feedbackIntent]]),
    ...authority.interactionAuthority.collections.map((collection) => ["surface", collection.collectionId, profile.intent.surfaces.collection])
  ].map(([dimension, targetId, declaredIntent]) => ({
    dimension, target: targetId, declaredIntent, disposition: "OBSERVED",
    nativeEvidence: { mechanism: `${target}-native`, locator: `${target}:${targetId}` }
  }));
  return {
    presentationTestimonyType: "consumer-ui-presentation-testimony.v1",
    applicationId: authority.applicationId,
    embodimentTarget: target,
    authorityDigest: identity.authorityDigest,
    presentationProfileDigest: canonicalDigest(profile),
    renderContexts: [{ contextId: "standard", viewport: { width: 900, height: 700 }, scale: 1, theme: "light", reducedMotion: false }],
    observations,
    platformNativeDisposition: "PASS"
  };
}

function structuralTestimony(target, objectModel) {
  const implementationRef = target === "wpf"
    ? "languages/csharp/src/ScenarioKernel.Wpf/ConsumerUiApplication.cs"
    : target === "react" ? "languages/typescript/runtimes/browser/runtime/consumer-ui-semantic-model.mjs"
      : target === "javafx" ? "languages/java/presentation/javafx/src/main/java/scenario/kernel/javafx/ConsumerUiModel.java"
        : "languages/typescript/presentation/browser-dom/runtime/authority-backed-dom-application.mjs";
  return {
    structuralTestimonyType: "consumer-ui-structural-testimony.v1",
    embodimentTarget: target,
    objectModelDigest: canonicalDigest(objectModel),
    implementationRefs: [implementationRef],
    concepts: objectModel.concepts.map((concept) => ({
      conceptId: concept.conceptId,
      representation: target === "wpf" ? "record-or-class" : "frozen-object-or-contract",
      implementationRef,
      members: [...concept.requiredMembers],
      relationships: structuredClone(concept.relationships),
      behaviors: [...concept.requiredBehaviors]
    })),
    rawAuthorityAccessSites: [{ implementationRef, member: "admitAuthority", disposition: "ADMISSION_BOUNDARY" }],
    targetOwnedSemanticConcepts: [],
    disposition: "PASS"
  };
}

test("UI parity projection freezes one authority and emits every admitted and declared claimant", async (t) => {
  const isolatedWorkspace = fs.mkdtempSync(path.join(path.dirname(WORKSPACE_ROOT), ".generic-ui-parity-foundation-"));
  t.after(() => fs.rmSync(isolatedWorkspace, { recursive: true, force: true }));
  fs.cpSync(WORKSPACE_ROOT, isolatedWorkspace, {
    recursive: true,
    filter(candidate) {
      const relative = path.relative(WORKSPACE_ROOT, candidate);
      const topLevel = relative.split(path.sep)[0];
      return !relative || !["artifacts", "projected"].includes(topLevel);
    }
  });
  await projectConsumerCapability(isolatedWorkspace, { repositoryRoot: REPO_ROOT, projectionTargets: ["node", "csharp"] });
  const result = projectUiParity(isolatedWorkspace);
  const generatedCache = path.join(isolatedWorkspace, "projected", "android-compose", ".gradle", "checksums.lock");
  fs.mkdirSync(path.dirname(generatedCache), { recursive: true });
  fs.writeFileSync(generatedCache, "generated cache", "utf8");
  await projectConsumerCapability(isolatedWorkspace, { repositoryRoot: REPO_ROOT, projectionTargets: ["node", "csharp"] });
  assert.equal(fs.existsSync(generatedCache), false);
  assert.equal(result.executableOrigin, "PROJECTED_ONLY");
  assert.deepEqual(result.targets, ["wpf", "react", "html", "javafx", "cpp-appkit"]);
  assert.deepEqual(result.declaredTargets, ["swiftui", "android-compose", "avalonia"]);
  assert.deepEqual(result.projectedTargets, ["wpf", "react", "html", "javafx", "cpp-appkit", "swiftui", "android-compose", "avalonia"]);
  for (const target of ["react", "html"]) {
    const seam = fs.readFileSync(path.join(isolatedWorkspace, "projected", target, "application.generated.mjs"), "utf8");
    const conformance = readFrom(isolatedWorkspace, `projected/${target}/projection-conformance.json`);
    assert.match(seam, /^\/\/ GENERATED PURE UI PROJECTION SEAM/);
    assert.equal(conformance.disposition, "PURE_PROJECTION_CONFORMS");
    assert.equal(conformance.violations.length, 0);
  }
  const registry = readFrom(isolatedWorkspace, "projected/ui-parity/targets.json");
  assert.deepEqual(registry.admittedTargets, ["wpf", "react", "html", "javafx", "cpp-appkit"]);
  assert.ok(registry.claimants.every((claimant) => claimant.featureAdmission.disposition === "SUPPORTED"));
  assert.ok(registry.claimants.every((claimant) => claimant.featureAdmission.resolutions.length > 30));
  assert.equal(registry.claimants.find((claimant) => claimant.target === "react").embodimentProviderId, "sda-react-ir-embodiment-provider.v1");
  const presentationIr = readFrom(isolatedWorkspace, "projected/react/authority/ui-presentation-ir.react.json");
  const reactManifest = readFrom(isolatedWorkspace, "projected/react/projection-manifest.json");
  assert.equal(presentationIr.presentationIrType, "sda-ui-presentation-ir.v2");
  assert.equal(reactManifest.presentationIrDigest, canonicalDigest(presentationIr));
  assert.equal(reactManifest.embodimentProviderId, "sda-react-ir-embodiment-provider.v1");
  const javaFxManifest = readFrom(isolatedWorkspace, "projected/javafx/projection-manifest.json");
  assert.equal(javaFxManifest.claimantStatus, "ADMITTED");
  assert.equal(javaFxManifest.implementationDisposition, "NATIVE_PROOF_ADMITTED");
  assert.equal(javaFxManifest.nativeTestimonyDisposition, "REQUIRED");
  assert.equal(javaFxManifest.featureAdmission.disposition, "SUPPORTED");
  assert.match(javaFxManifest.featureCatalogDigest, /^sha256:[a-f0-9]{64}$/);
  const cppSeam = fs.readFileSync(path.join(isolatedWorkspace, "projected", "cpp-appkit", "main.generated.cpp"), "utf8");
  const cppConformance = readFrom(isolatedWorkspace, "projected/cpp-appkit/projection-conformance.json");
  const cppManifest = readFrom(isolatedWorkspace, "projected/cpp-appkit/projection-manifest.json");
  assert.match(cppSeam, /^\/\/ GENERATED PURE UI PROJECTION SEAM/);
  assert.equal(cppConformance.disposition, "PURE_PROJECTION_CONFORMS");
  assert.equal(cppManifest.claimantStatus, "ADMITTED");
  assert.equal(cppManifest.implementationDisposition, "NATIVE_PROOF_ADMITTED");
  assert.equal(cppManifest.nativeTestimonyDisposition, "REQUIRED");
  assert.equal(registry.claimants.find((claimant) => claimant.target === "cpp-appkit").staticImplementation.claimedConceptCount, 42);
  for (const target of ["swiftui", "android-compose"]) {
    const conformance = readFrom(isolatedWorkspace, `projected/${target}/projection-conformance.json`);
    const manifest = readFrom(isolatedWorkspace, `projected/${target}/projection-manifest.json`);
    assert.equal(conformance.disposition, "PURE_PROJECTION_CONFORMS");
    assert.equal(manifest.claimantStatus, "DECLARED");
    assert.equal(manifest.implementationDisposition, "IMPLEMENTED_AWAITING_NATIVE_PROOF");
    assert.equal(manifest.nativeTestimonyDisposition, "NOT_ADMITTED");
  }
  const authority = readFrom(isolatedWorkspace, "ui.authority.json");
  const identity = readFrom(isolatedWorkspace, "ui.authority.identity.json");
  assert.deepEqual(createUiAuthorityIdentity("ui.authority.json", authority), identity);
});

test("cross-apply UI parity closes through Consumer Assurance and isolates dimension failures", async () => {
  const authority = read("ui.authority.json");
  const objectModel = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "consumer-ui-object-model.semantic-authority.json"), "utf8"));
  const identity = read("ui.authority.identity.json");
  const vectors = read("ui.vectors.json");
  const coverage = read("ui.experience-coverage.json");
  const wpfTestimony = testimony("wpf", identity, vectors);
  const reactTestimony = testimony("react", identity, vectors);
  const wpfWiring = wiring("wpf", authority, identity);
  const reactWiring = wiring("react", authority, identity);
  const wpfPresentation = presentation("wpf", authority, identity);
  const reactPresentation = presentation("react", authority, identity);
  const wpfStructure = structuralTestimony("wpf", objectModel);
  const reactStructure = structuralTestimony("react", objectModel);
  const htmlTestimony = testimony("html", identity, vectors);
  const htmlWiring = wiring("html", authority, identity);
  const htmlPresentation = presentation("html", authority, identity);
  const htmlStructure = structuralTestimony("html", objectModel);
  const claimants = [
    { target: "wpf", testimony: wpfTestimony, presentation: wpfPresentation, wiring: wpfWiring, structure: wpfStructure },
    { target: "react", testimony: reactTestimony, presentation: reactPresentation, wiring: reactWiring, structure: reactStructure },
    { target: "html", testimony: htmlTestimony, presentation: htmlPresentation, wiring: htmlWiring, structure: htmlStructure }
  ];
  const assurance = await new ConsumerAssuranceService(REPO_ROOT).proveCrossApplyUiParity(WORKSPACE_ROOT, {
    identity, objectModel, vectors, coverage, claimants
  });
  assert.equal(assurance.scenarioId, "prove-cross-apply-ui-parity");
  assert.equal(assurance.closure.obligationDisposition.kind, "SATISFIED");
  assert.equal(assurance.closure.evidence.crossApplyDisposition, "CROSS_APPLY_UI_CONFORMANT");
  assert.equal(assurance.closure.evidence.experienceParity, "PASS");
  assert.equal(assurance.closure.evidence.proofCellCount, 44);

  const divergent = structuredClone(reactTestimony);
  const observed = divergent.vectorResults.flatMap((vector) => vector.steps)
    .find((step) => step.observations.accessibility.length > 0);
  observed.observations.accessibility[0].value = "different-accessibility-intent";
  const evidence = new UiParityEvaluator().evaluate({
    identity, objectModel, vectors, coverage, claimants: claimants.map((claimant) => claimant.target === "react" ? { ...claimant, testimony: divergent } : claimant)
  });
  assert.equal(evidence.gates.ACCESSIBILITY_PARITY.disposition, "FAIL");
  assert.equal(evidence.gates.STATE_PARITY.disposition, "PASS");
  assert.equal(evidence.experienceParity, "FAIL");

  const presentationDivergence = structuredClone(reactPresentation);
  presentationDivergence.observations.find((observation) => observation.dimension === "action-emphasis").declaredIntent = "quiet";
  const presentationEvidence = new UiParityEvaluator().evaluate({
    identity, objectModel, vectors, coverage, claimants: claimants.map((claimant) => claimant.target === "react" ? { ...claimant, presentation: presentationDivergence } : claimant)
  });
  assert.equal(presentationEvidence.gates.ACTION_EMPHASIS_PARITY.disposition, "FAIL");
  assert.equal(presentationEvidence.gates.STATE_PARITY.disposition, "PASS");
  assert.equal(presentationEvidence.experienceParity, "FAIL");

  const structuralDivergence = structuredClone(reactStructure);
  structuralDivergence.concepts.find((concept) => concept.conceptId === "UiAction").members = ["actionId"];
  const structuralEvidence = new UiParityEvaluator().evaluate({
    identity, objectModel, vectors, coverage, claimants: claimants.map((claimant) => claimant.target === "react" ? { ...claimant, structure: structuralDivergence } : claimant)
  });
  assert.equal(structuralEvidence.targetGates.react.SEMANTIC_STRUCTURE.disposition, "FAIL");
  assert.equal(structuralEvidence.gates.STRUCTURAL_PARITY.disposition, "FAIL");
  assert.equal(structuralEvidence.gates.STATE_PARITY.disposition, "PASS");
  assert.equal(structuralEvidence.experienceParity, "FAIL");

  const boundaryLeak = structuredClone(reactStructure);
  boundaryLeak.rawAuthorityAccessSites.push({
    implementationRef: "languages/typescript/presentation/react/runtime/authority-backed-application.mjs",
    member: "render", disposition: "RUNTIME_LEAK"
  });
  const boundaryEvidence = new UiParityEvaluator().evaluate({
    identity, objectModel, vectors, coverage, claimants: claimants.map((claimant) => claimant.target === "react" ? { ...claimant, structure: boundaryLeak } : claimant)
  });
  assert.equal(boundaryEvidence.targetGates.react.RAW_AUTHORITY_BOUNDARY.disposition, "FAIL");
  assert.equal(boundaryEvidence.targetGates.react.SEMANTIC_STRUCTURE.disposition, "PASS");

  const inventedSemantics = structuredClone(reactStructure);
  inventedSemantics.targetOwnedSemanticConcepts.push("ReactComponentState");
  const ownershipEvidence = new UiParityEvaluator().evaluate({
    identity, objectModel, vectors, coverage, claimants: claimants.map((claimant) => claimant.target === "react" ? { ...claimant, structure: inventedSemantics } : claimant)
  });
  assert.equal(ownershipEvidence.targetGates.react.TARGET_SEMANTIC_OWNERSHIP.disposition, "FAIL");
  assert.equal(ownershipEvidence.gates.STRUCTURAL_PARITY.disposition, "PASS");
});

test("native C++ AppKit testimony closes against every admitted UI claimant", async () => {
  const modulePath = path.join(REPO_ROOT, "artifacts", "tools", "dist", "adapters", "projection", "node-target-toolchain.js");
  const { NodeTargetToolchain } = await import(pathToFileURL(modulePath).href);
  const toolchain = new NodeTargetToolchain(REPO_ROOT, "cpp");
  const execution = toolchain.proveUiClaimant();
  if (!toolchain.available()) {
    assert.equal(execution.ran, false);
    assert.match(execution.reason, /native runtime target is not compatible with the current host/);
    return;
  }
  assert.equal(execution.conforming, true, execution.stderr);

  const evidenceRoot = path.join(REPO_ROOT, "languages", "cpp", "build", "ui-parity-evidence");
  const cpp = {
    target: "cpp-appkit",
    testimony: JSON.parse(fs.readFileSync(path.join(evidenceRoot, "cpp-appkit-testimony.json"), "utf8")),
    presentation: JSON.parse(fs.readFileSync(path.join(evidenceRoot, "cpp-appkit-presentation-testimony.json"), "utf8")),
    wiring: JSON.parse(fs.readFileSync(path.join(evidenceRoot, "cpp-appkit-wiring.json"), "utf8")),
    structure: JSON.parse(fs.readFileSync(path.join(evidenceRoot, "cpp-appkit-structural-testimony.json"), "utf8"))
  };
  const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"));
  for (const [value, schema] of [
    [cpp.testimony, "consumer-ui-testimony.schema.json"],
    [cpp.presentation, "consumer-ui-presentation-testimony.schema.json"],
    [cpp.wiring, "consumer-ui-wiring-conformance.schema.json"],
    [cpp.structure, "consumer-ui-structural-testimony.schema.json"]
  ]) {
    const validation = admission.validate(value, schema);
    assert.equal(validation.valid, true, `${schema}: ${JSON.stringify(validation.errors)}`);
  }

  const authority = read("ui.authority.json");
  const identity = read("ui.authority.identity.json");
  const vectors = read("ui.vectors.json");
  const coverage = read("ui.experience-coverage.json");
  const objectModel = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "consumer-ui-object-model.semantic-authority.json"), "utf8"));
  const baselines = ["wpf", "react", "html", "javafx"].map((target) => ({
    target,
    testimony: testimony(target, identity, vectors),
    presentation: presentation(target, authority, identity),
    wiring: wiring(target, authority, identity),
    structure: structuralTestimony(target, objectModel)
  }));
  const proof = new UiParityEvaluator().evaluate({ identity, objectModel, vectors, coverage, claimants: [...baselines, cpp] });
  const proofAdmission = admission.validate(proof, "consumer-ui-parity-evidence.schema.json");
  assert.equal(proofAdmission.valid, true, JSON.stringify(proofAdmission.errors));
  assert.equal(proof.targets.length, 5);
  assert.equal(proof.targetGates["cpp-appkit"].PLATFORM_NATIVE.disposition, "PASS");
  assert.equal(proof.targetGates["cpp-appkit"].FRAMEWORK_WIRING.disposition, "PASS");
  assert.equal(proof.targetGates["cpp-appkit"].EXECUTABLE_ORIGIN.disposition, "PROJECTED_ONLY");
  assert.equal(proof.experienceParity, "PASS");
  assert.equal(proof.proofCellCount, 56);
});

test("UI parity canonical artifacts are schema-admitted", () => {
  const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"));
  const authority = read("ui.authority.json");
  const identity = read("ui.authority.identity.json");
  const values = [
    [read("ui.authority.identity.json"), "consumer-ui-authority-identity.schema.json"],
    [read("ui.vectors.json"), "consumer-ui-vector.schema.json"],
    [read("ui.experience-coverage.json"), "consumer-ui-experience-coverage.schema.json"],
    [JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "sda-ui-embodiment-capabilities.semantic-authority.json"), "utf8")), "consumer-ui-embodiment-capability-catalog.schema.json"],
    [presentation("wpf", authority, identity), "consumer-ui-presentation-testimony.schema.json"],
    [JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "consumer-ui-object-model.semantic-authority.json"), "utf8")), "consumer-ui-object-model.schema.json"],
    [structuralTestimony("wpf", JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "consumer-ui-object-model.semantic-authority.json"), "utf8"))), "consumer-ui-structural-testimony.schema.json"]
  ];
  for (const implementationRoot of [
    ["java", "presentation", "javafx"],
    ["swift", "presentation", "swiftui"],
    ["kotlin", "presentation", "android-compose"],
    ["csharp", "src", "ScenarioKernel.Avalonia"]
  ]) values.push([
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "languages", ...implementationRoot, "conformance", "semantic-implementation.json"), "utf8")),
    "consumer-ui-claimant-implementation.schema.json"
  ]);
  values.push([
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "languages", "cpp", "conformance", "ui-semantic-implementation.json"), "utf8")),
    "consumer-ui-claimant-implementation.schema.json"
  ]);
  values.push([
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "languages", "cpp", "ui", "projection-profile.json"), "utf8")),
    "consumer-ui-projection-profile.schema.json"
  ]);
  for (const [value, schema] of values) {
    const result = admission.validate(value, schema);
    assert.equal(result.valid, true, `${schema}: ${JSON.stringify(result.errors)}`);
  }
});

test("unadmitted native claimant implementations cover all 42 concepts without emitting testimony", () => {
  const objectModel = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "consumer-ui-object-model.semantic-authority.json"), "utf8"));
  const catalog = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "sda-ui-embodiment-capabilities.semantic-authority.json"), "utf8"));
  for (const target of ["swiftui", "android-compose", "avalonia"]) {
    const capability = catalog.capabilities.find((candidate) => candidate.embodimentTarget === target);
    const admission = admitUiClaimantImplementation(REPO_ROOT, capability.staticConformanceRef, target, objectModel);
    assert.equal(capability.status, "DECLARED");
    assert.equal(admission.disposition, "PASS", admission.findings.join("\n"));
    assert.equal(admission.claimedConceptCount, 42);
    assert.equal(fs.existsSync(path.join(WORKSPACE_ROOT, "projected", "ui-parity", `${target}-testimony.json`)), false);
  }
});
