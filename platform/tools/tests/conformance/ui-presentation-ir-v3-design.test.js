"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "ui-presentation-protocol");
const CONTRACTS_ROOT = path.join(PACKAGE_ROOT, "contracts");
const FIXTURES_ROOT = path.join(PACKAGE_ROOT, "fixtures", "v3-compiled");

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8"));
}

test("ADR-0009 digest-binds the compiler and embodiment-planning v3 successor identity", async () => {
  const { canonicalDigest } = await import("../../../artifacts/tools/dist/ui-parity/proof/canonical-ui-authority.js");
  const identity = read("capabilities/sda-platform/ui-presentation-protocol/successor.identity.json");
  const schema = read("capabilities/sda-platform/ui-presentation-protocol/contracts/sda-ui-presentation-ir.v3.schema.json");
  assert.equal(identity.protocolType, "sda-ui-presentation-ir.v3");
  assert.equal(identity.status, "CSHARP_REFERENCE_PROVIDERS_IMPLEMENTED");
  assert.equal(identity.sourceContractType, "sda-ui-semantic-presentation.v1");
  assert.equal(identity.predecessorProtocolType, "sda-ui-presentation-ir.v2");
  assert.equal(identity.compatibilityDisposition, "DIRECTIONAL_COMPILER_ONLY");
  assert.equal(identity.productionCompilerDisposition, "DETERMINISTIC_REFERENCE_IMPLEMENTED");
  const compilerAuthority = read(identity.compilerAuthorityRef);
  assert.equal(identity.compilerAuthorityDigest, compilerAuthority.authorityDigest);
  const providerRegistry = read(identity.providerRegistryRef);
  assert.equal(providerRegistry.protocolSchemaDigest, identity.schemaDigest);
  const bindingModel = read(identity.protocolBindingModelRef);
  assert.equal(bindingModel.protocolSchemaDigest, identity.schemaDigest);
  assert.equal(identity.legacyCompatibilityDisposition, "DIRECTIONAL_REPAIR_GATED");
  assert.equal(fs.existsSync(path.join(REPOSITORY_ROOT, identity.legacyCompatibilityRef)), true);
  assert.equal(identity.referenceProviderDisposition, "REACT_AND_DOM_STRUCTURAL_ADMITTED");
  assert.equal(fs.existsSync(path.join(REPOSITORY_ROOT, identity.referenceProviderCapabilityRef)), true);
  assert.equal(identity.csharpProviderDisposition, "WPF_AND_AVALONIA_STRUCTURAL_ADMITTED");
  assert.equal(fs.existsSync(path.join(REPOSITORY_ROOT, identity.csharpSharedInterpreterRef)), true);
  assert.equal(canonicalDigest(schema), identity.schemaDigest);
  const decision = fs.readFileSync(path.join(REPOSITORY_ROOT, identity.decisionRef), "utf8");
  assert.match(decision, /\*\*Status:\*\* Accepted/u);
  assert.match(decision, /successor is `sda-ui-presentation-ir\.v3`/u);
});

test("v3 admits canonical compiler-produced normalized-mechanic fixtures", async () => {
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  for (const file of fs.readdirSync(FIXTURES_ROOT).filter((name) => name.endsWith(".json")).sort()) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_ROOT, file), "utf8"));
    assert.equal(admission.validate(fixture, "sda-ui-presentation-ir.v3.schema.json").valid, true, file);
    const { presentationIrV3Digest } = await import("../../../artifacts/tools/dist/ui-presentation/application/semantic-presentation-compiler.js");
    assert.equal(presentationIrV3Digest(fixture), fixture.canonicalDigest, file);
  }
  const empty = JSON.parse(fs.readFileSync(path.join(FIXTURES_ROOT, "empty.sda-ui-presentation-ir.v3.json"), "utf8"));
  assert.deepEqual(empty.rootNodeIds, []);
  assert.deepEqual(empty.nodes, []);
});

test("v3 owns only the approved normalized mechanic vocabulary", () => {
  const schema = read("capabilities/sda-platform/ui-presentation-protocol/contracts/sda-ui-presentation-ir.v3.schema.json");
  const mechanics = schema.$defs.node.properties.configuration.oneOf
    .map((item) => item.$ref.split("/").at(-1))
    .map((definition) => schema.$defs[definition].properties.kind.const)
    .sort();
  assert.deepEqual(mechanics, ["FLOW", "GRID", "OVERLAY", "SCROLL", "SPLIT", "STACK"]);
  const encoded = JSON.stringify(schema);
  assert.doesNotMatch(encoded, /\b(?:react|wpf|xaml|css|html|javafx|swiftui|compose|appkit|winui|avalonia|qt|fyne)\b/iu);
  assert.doesNotMatch(encoded, /\b(?:resume|job-market|candidate-card|application-shell|consumer-recipe)\b/iu);
});

test("v3 rejects target hints, consumer recipes, implicit defaults, and unknown mechanics", async () => {
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const minimal = JSON.parse(fs.readFileSync(path.join(FIXTURES_ROOT, "minimal.sda-ui-presentation-ir.v3.json"), "utf8"));
  for (const mutate of [
    (value) => { value.targetFramework = "invented-target"; },
    (value) => { value.consumerRecipe = "invented-consumer-meaning"; },
    (value) => { value.implicitDefaults = true; },
    (value) => { value.nodes[0].configuration.kind = "TARGET_WIDGET"; }
  ]) {
    const candidate = structuredClone(minimal);
    mutate(candidate);
    assert.equal(admission.validate(candidate, "sda-ui-presentation-ir.v3.schema.json").valid, false);
  }
});

test("frozen v2 and compiler-implemented v3 are not implicitly substitutable", async () => {
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const admission = new AjvSchemaAdmission(CONTRACTS_ROOT);
  const v3 = JSON.parse(fs.readFileSync(path.join(FIXTURES_ROOT, "minimal.sda-ui-presentation-ir.v3.json"), "utf8"));
  assert.equal(admission.validate(v3, "sda-ui-presentation-ir.v2.schema.json").valid, false);
  const v2Schema = read("capabilities/sda-platform/ui-presentation-protocol/contracts/sda-ui-presentation-ir.v2.schema.json");
  assert.equal(v2Schema.properties.presentationIrType.const, "sda-ui-presentation-ir.v2");
});
