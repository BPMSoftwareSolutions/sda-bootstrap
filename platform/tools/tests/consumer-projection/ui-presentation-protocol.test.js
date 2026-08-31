"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "ui-presentation-protocol");

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8"));
}

function providerRequest(authority, compilation) {
  const identity = read("examples/generic-capability/ui.authority.identity.json");
  const objectModelRef = "kernel/semantic-authority/consumer/consumer-ui-object-model.semantic-authority.json";
  const objectModel = read(objectModelRef);
  return {
    target: "react",
    capabilityId: "sda-react-ui.v1",
    authority,
    authorityRef: "ui.authority.json",
    authorityContent: `${JSON.stringify(authority, null, 2)}\n`,
    identity,
    identityContent: `${JSON.stringify(identity, null, 2)}\n`,
    vectorRef: "ui.vectors.json",
    vectorContent: `${JSON.stringify(read("examples/generic-capability/ui.vectors.json"), null, 2)}\n`,
    coverageRef: "ui.experience-coverage.json",
    coverageContent: `${JSON.stringify(read("examples/generic-capability/ui.experience-coverage.json"), null, 2)}\n`,
    objectModelRef,
    objectModel,
    objectModelContent: `${JSON.stringify(objectModel, null, 2)}\n`,
    compilation
  };
}

test("the v2 presentation protocol, compatibility policy, and provider registry are closed and digest-bound", async () => {
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const identity = read("capabilities/sda-platform/ui-presentation-protocol/protocol.identity.json");
  const schema = read("capabilities/sda-platform/ui-presentation-protocol/contracts/sda-ui-presentation-ir.v2.schema.json");
  const policy = read("capabilities/sda-platform/ui-presentation-protocol/compatibility-policy.json");
  const registry = read("capabilities/sda-platform/ui-presentation-protocol/provider-registry.json");
  assert.equal(canonicalDigest(schema), identity.schemaDigest);
  assert.equal(canonicalDigest(policy), identity.compatibilityPolicyDigest);
  assert.equal(registry.protocolSchemaDigest, identity.schemaDigest);
  assert.equal(policy.rules.rendererAuthorityAccess, "FORBIDDEN");
  assert.equal(policy.rules.silentFallback, "FORBIDDEN");
  const admission = new AjvSchemaAdmission(path.join(PACKAGE_ROOT, "contracts"));
  assert.equal(admission.validate(registry, "ui-embodiment-provider-registry.v1.schema.json").valid, true);
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
});

test("the target-neutral compiler normalizes authority into schema-admitted IR with semantic events and state patches", async () => {
  const { UiPresentationCompiler } = await import(
    "../../../artifacts/tools/dist/ui-parity/application/ui-presentation-compiler.js"
  );
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const authority = read("examples/generic-capability/ui.authority.json");
  const compiler = new UiPresentationCompiler(REPOSITORY_ROOT);
  const first = compiler.compile(authority);
  const second = compiler.compile(structuredClone(authority));
  assert.deepEqual(first, second);
  assert.equal(first.ir.presentationIrType, "sda-ui-presentation-ir.v2");
  assert.equal(first.evidence.disposition, "COMPILED");
  assert.ok(first.ir.requiredFeatureIds.length > 30);
  assert.ok(first.ir.application.interaction.actions.every((action) => action.eventId.startsWith("event.action.")));
  assert.ok(first.ir.application.interaction.events.every((event) => event.operationId));
  assert.ok(first.ir.application.interaction.statePatches.length > 0);
  const admission = new AjvSchemaAdmission(path.join(PACKAGE_ROOT, "contracts"));
  assert.equal(admission.validate(first.ir, "sda-ui-presentation-ir.v2.schema.json").valid, true);
  const { admitConsumerUiPresentationIr } = await import(
    "../../../languages/typescript/runtimes/browser/runtime/consumer-ui-semantic-model.mjs"
  );
  const admittedApplication = admitConsumerUiPresentationIr(first.ir);
  const fixturePatch = admittedApplication.interaction.statePatches.find((patch) =>
    patch.assignments.some((assignment) => assignment.sourceKind === "fixture-value")
  );
  const fixtureAssignment = fixturePatch.assignments.find((assignment) => assignment.sourceKind === "fixture-value");
  assert.deepEqual(
    admittedApplication.interaction.applyStatePatch(fixturePatch.operationId, {}, {
      "fixture-value": { [fixtureAssignment.sourcePath]: { admitted: true } }
    }),
    { [fixtureAssignment.stateId]: JSON.stringify({ admitted: true }, null, 2) }
  );
  const leakedRendererDetail = structuredClone(first.ir);
  leakedRendererDetail.application.interaction.operations[0].arguments.rendererHint = "special-case-widget";
  assert.equal(
    admission.validate(leakedRendererDetail, "sda-ui-presentation-ir.v2.schema.json").valid,
    false,
    "the closed protocol must reject undeclared nested renderer details"
  );
  const compilerSource = fs.readFileSync(path.join(
    REPOSITORY_ROOT, "tools", "src", "ui-parity", "application", "ui-presentation-compiler.ts"
  ), "utf8");
  assert.doesNotMatch(compilerSource, /\b(?:react|wpf|html|javafx|swiftui|android-compose)\b/iu);
  assert.equal(compilerSource.includes(authority.applicationId), false);
  const executorSource = fs.readFileSync(path.join(
    REPOSITORY_ROOT, "languages", "typescript", "runtimes", "browser", "runtime", "ui-operation-executor.mjs"
  ), "utf8");
  assert.match(executorSource, /interaction\.applyStatePatch/);
  assert.match(executorSource, /executeEvent\(eventId/);
  assert.doesNotMatch(executorSource, /args\.targetBindings/);
});

test("all language model bindings are generated from the same protocol definition and schema digest", async () => {
  const { generateUiProtocolLanguageModels } = await import(
    "../../../artifacts/tools/dist/ui-parity/application/ui-protocol-language-model-generator.js"
  );
  const generated = generateUiProtocolLanguageModels(REPOSITORY_ROOT);
  assert.deepEqual(generated.map((item) => path.basename(item.relativePath)), [
    "sda-ui-presentation-ir.typescript.model.json",
    "sda-ui-presentation-ir.csharp.model.json",
    "sda-ui-presentation-ir.java.model.json",
    "sda-ui-presentation-ir.swift.model.json",
    "sda-ui-presentation-ir.kotlin.model.json"
  ]);
  for (const model of generated) {
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, model.relativePath), "utf8")),
      JSON.parse(model.content)
    );
  }
  const digests = new Set(generated.map((item) => JSON.parse(item.content).protocolSchemaDigest));
  assert.equal(digests.size, 1);
});

test("React embodiment is discovered from registry data and consumes presentation IR instead of raw authority", async () => {
  const { UiPresentationCompiler } = await import(
    "../../../artifacts/tools/dist/ui-parity/application/ui-presentation-compiler.js"
  );
  const { NodeUiEmbodimentProviderRegistry } = await import(
    "../../../artifacts/tools/dist/adapters/ui-parity/node-ui-embodiment-provider-registry.js"
  );
  const authority = read("examples/generic-capability/ui.authority.json");
  const compilation = new UiPresentationCompiler(REPOSITORY_ROOT).compile(authority);
  const registry = new NodeUiEmbodimentProviderRegistry(REPOSITORY_ROOT);
  const provider = registry.discover("react", "sda-react-ui.v1");
  assert.ok(provider);
  assert.equal(registry.discover("html", "sda-html-ui.v1"), null);
  const files = provider.materialize(providerRequest(authority, compilation));
  const seam = files.find((item) => item.relativePath === "react/application.generated.mjs").content;
  assert.match(seam, /ui-presentation-ir\.react\.json/);
  assert.doesNotMatch(seam, /ui-authority\.react\.json/);
  assert.ok(files.some((item) => item.relativePath.endsWith("ui-presentation-compilation-evidence.react.json")));
});

test("authority-only pressure mutations change IR without renderer or provider-seam churn", async () => {
  const { UiPresentationCompiler } = await import(
    "../../../artifacts/tools/dist/ui-parity/application/ui-presentation-compiler.js"
  );
  const { NodeUiEmbodimentProviderRegistry } = await import(
    "../../../artifacts/tools/dist/adapters/ui-parity/node-ui-embodiment-provider-registry.js"
  );
  const compiler = new UiPresentationCompiler(REPOSITORY_ROOT);
  const provider = new NodeUiEmbodimentProviderRegistry(REPOSITORY_ROOT).discover("react", "sda-react-ui.v1");
  const base = read("examples/generic-capability/ui.authority.json");
  const variants = [];

  const layout = structuredClone(base);
  layout.presentationProfile.views[0].layoutIntent = "column";
  variants.push(["layout-recomposition", layout]);

  const adaptive = structuredClone(base);
  adaptive.presentationProfile.adaptation.compactRegionOrder = [adaptive.presentationProfile.views[0].regions[0].regionId];
  variants.push(["compact-order", adaptive]);

  const tokens = structuredClone(base);
  tokens.presentationProfile.tokens.colors.primaryAction = "#123456";
  variants.push(["token-change", tokens]);

  const regionAddition = structuredClone(base);
  const addedRegion = structuredClone(regionAddition.presentationProfile.views[0].regions[0]);
  addedRegion.regionId = "secondary-evidence";
  addedRegion.title = "Secondary evidence";
  addedRegion.role = "proof";
  addedRegion.importance = "supporting";
  addedRegion.items = [structuredClone(addedRegion.items[0])];
  regionAddition.presentationProfile.views[0].regions.push(addedRegion);
  variants.push(["region-addition", regionAddition]);

  const regionRemoval = structuredClone(regionAddition);
  regionRemoval.presentationProfile.views[0].regions = regionRemoval.presentationProfile.views[0].regions.filter(
    (region) => region.regionId !== "execution"
  );
  variants.push(["region-removal", regionRemoval]);

  const composition = structuredClone(base);
  composition.interactionAuthority.feedback[1].feedbackIntent = "document";
  composition.interactionAuthority.feedback[1].presentationIntent = "plain";
  variants.push(["document-composition", composition]);

  const eventBinding = structuredClone(base);
  eventBinding.interactionAuthority.actions[0].operationId = eventBinding.interactionAuthority.actions[1].operationId;
  variants.push(["existing-event-binding", eventBinding]);

  const baseCompilation = compiler.compile(base);
  const baseFiles = provider.materialize(providerRequest(base, baseCompilation));
  const baseSeam = baseFiles.find((item) => item.relativePath === "react/application.generated.mjs").content;
  const observedDigests = new Set([baseCompilation.evidence.presentationIrDigest]);
  for (const [name, authority] of variants) {
    const compilation = compiler.compile(authority);
    assert.equal(observedDigests.has(compilation.evidence.presentationIrDigest), false, name);
    observedDigests.add(compilation.evidence.presentationIrDigest);
    const seam = provider.materialize(providerRequest(authority, compilation))
      .find((item) => item.relativePath === "react/application.generated.mjs").content;
    assert.equal(seam, baseSeam, name);
  }
});
