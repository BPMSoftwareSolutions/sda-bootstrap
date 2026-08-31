"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT } = require("./reference-workspace.cjs");
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
const {
  collectUiFeatureRequirements,
  resolveUiFeatureCapabilities
} = require("../../../artifacts/tools/dist/ui-parity/proof/ui-feature-admission.js");

const PACKAGE_ROOT = path.join(REPO_ROOT, "capabilities", "sda-platform", "ui-embodiment");
const CONTRACT_ROOT = path.join(PACKAGE_ROOT, "contracts");
const authority = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "examples", "generic-capability", "ui.authority.json"), "utf8"));
const catalog = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "feature-capabilities.json"), "utf8"));

test("the frozen v1 authority closes into explicit feature-level provider evidence", () => {
  const admission = new AjvSchemaAdmission(CONTRACT_ROOT);
  assert.equal(admission.validate(catalog, "ui-embodiment-feature-catalog.schema.json").valid, true);
  const freeze = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "governance", "ui", "consumer-ui-authority-v1.freeze.json"), "utf8"));
  assert.equal(catalog.protocol.schemaDigest, freeze.schemaDigest);
  assert.equal(catalog.protocol.schemaRef, freeze.schemaRef);
  assert.equal(new Set(catalog.profiles.map((profile) => profile.profileId)).size, catalog.profiles.length);
  assert.equal(new Set(catalog.providers.map((provider) => provider.embodimentTarget)).size, catalog.providers.length);
  for (const provider of catalog.providers) {
    assert.ok(catalog.profiles.some((profile) => profile.profileId === provider.featureProfileId), provider.featureProfileId);
    for (const evidenceRef of [...provider.evidenceRefs, ...(provider.adaptedFeatures ?? []).flatMap((feature) => feature.evidenceRefs)]) {
      assert.ok(fs.existsSync(path.join(REPO_ROOT, evidenceRef)), evidenceRef);
    }
  }

  const requirements = collectUiFeatureRequirements(authority);
  assert.ok(requirements.length > 30);
  assert.ok(requirements.some((requirement) => requirement.featureId === "ui.operation-execute-capability.v1"));
  for (const provider of catalog.providers) {
    const evidence = resolveUiFeatureCapabilities(authority, catalog, provider.embodimentTarget, provider.capabilityId);
    assert.equal(evidence.disposition, "SUPPORTED", provider.embodimentTarget);
    assert.equal(evidence.requiredFeatureCount, requirements.length);
    assert.ok(evidence.resolutions.every((resolution) => resolution.disposition === "SUPPORTED" || resolution.disposition === "ADAPTED"));
    assert.equal(admission.validate(evidence, "ui-feature-admission-evidence.schema.json").valid, true, provider.embodimentTarget);
  }
  const swift = resolveUiFeatureCapabilities(authority, catalog, "swiftui", "sda-swiftui-ui.v1");
  assert.deepEqual(swift.resolutions.filter((resolution) => resolution.disposition === "ADAPTED").map((resolution) => resolution.featureId), [
    "ui.adaptation.v1", "ui.experience.v1", "ui.presentation-intent.v1", "ui.presentation-tokens.v1"
  ]);
});

test("an absent required feature produces a stable pre-generation NOT_SUPPORTED result", () => {
  const missing = structuredClone(catalog);
  const reference = missing.profiles.find((profile) => profile.profileId === "consumer-ui-v1-reference.v1");
  const browser = missing.profiles.find((profile) => profile.profileId === "consumer-ui-v1-browser-reference.v1");
  missing.profiles.push({
    profileId: "consumer-ui-v1-missing-application.v1",
    featureIds: [...new Set([...reference.featureIds, ...browser.featureIds])].filter((featureId) => featureId !== "ui.application.v1")
  });
  missing.providers.find((provider) => provider.embodimentTarget === "html").featureProfileId = "consumer-ui-v1-missing-application.v1";
  const evidence = resolveUiFeatureCapabilities(authority, missing, "html", "sda-html-ui.v1");
  assert.equal(evidence.disposition, "NOT_SUPPORTED");
  assert.deepEqual(evidence.resolutions.filter((resolution) => resolution.disposition === "NOT_SUPPORTED").map((resolution) => resolution.featureId), ["ui.application.v1"]);
});

test("a frozen-v1 field without an admitted meaning is rejected before feature resolution", () => {
  const unknown = structuredClone(authority);
  unknown.interactionAuthority.inputs[0].unadmittedBehavior = "silent-fallback";
  const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"));
  assert.equal(admission.validate(unknown, "consumer-ui-authority.schema.json").valid, false);
});
