import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createNodeMechanicRegistry, resolveCanonicalCapabilityFeature } from "./node-mechanic-registry-loader.mjs";

const feature = `@capability:proof-capability
@root-scenario:prove-resolution
Feature: Prove resolution

  @scenario:prove-resolution
  @input:proof-request
  @input-contract:proof-request.v1
  @event:prove-resolution
  @event-authority:prove-resolution.v1
  @outcome:proof
  @outcome-contract:proof.v1
  @outcome-terminal
  Scenario: Prove resolution
    Given a request
    When it is resolved
    Then proof is returned
`;

function bindingUrl(root) {
  return pathToFileURL(path.join(root, "projected", "application-binding.node.json"));
}

test("resolves a capability identity beneath an explicitly governed root and preserves exact bytes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-canonical-feature-"));
  try {
    fs.mkdirSync(path.join(root, "features"));
    fs.mkdirSync(path.join(root, "projected"));
    fs.writeFileSync(path.join(root, "features", "proof-capability.feature"), feature, "utf8");
    const result = resolveCanonicalCapabilityFeature(
      { governedRootRefs: [".."] },
      { carrierType: "capability-feature-authoring-request.v1", featureReference: "proof-capability" },
      bindingUrl(root)
    );
    assert.equal(result.featureType, "canonical-capability-feature.v1");
    assert.equal(result.sourceRef, "features/proof-capability.feature");
    assert.equal(result.source, feature);
    assert.deepEqual(result.identities, {
      capabilityId: "proof-capability",
      scenarioId: "prove-resolution",
      inputId: "proof-request",
      inputContractId: "proof-request.v1",
      eventId: "prove-resolution",
      eventAuthorityId: "prove-resolution.v1",
      outcomeId: "proof",
      outcomeContractId: "proof.v1"
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("registry dispatch supplies the application binding URL to the canonical feature provider", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-canonical-feature-registry-"));
  try {
    fs.mkdirSync(path.join(root, "features"));
    fs.mkdirSync(path.join(root, "projected"));
    fs.writeFileSync(path.join(root, "features", "proof-capability.feature"), feature, "utf8");
    const registry = createNodeMechanicRegistry({
      bindingUrl: bindingUrl(root),
      invokeBinding: async () => { throw new Error("Nested invocation is not used."); }
    });
    const provider = registry.eventPorts.get("sda-canonical-capability-feature-resolution-port.v1");
    assert.ok(provider);
    const result = await provider(
      { configuration: { governedRootRefs: [".."] } },
      { carrierType: "capability-feature-authoring-request.v1", featureReference: "proof-capability" },
      {}
    );
    assert.equal(result.sourceRef, "features/proof-capability.feature");
    assert.equal(result.identities.capabilityId, "proof-capability");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects missing, non-feature, outside-root, and malformed feature references", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-canonical-feature-reject-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sda-canonical-feature-outside-"));
  try {
    fs.mkdirSync(path.join(root, "projected"));
    fs.writeFileSync(path.join(root, "not-feature.json"), "{}", "utf8");
    fs.writeFileSync(path.join(root, "malformed.feature"), "Feature: Missing authority tags\n", "utf8");
    fs.writeFileSync(path.join(outside, "outside.feature"), feature, "utf8");
    const resolve = (featureReference) => resolveCanonicalCapabilityFeature(
      { governedRootRefs: [".."] },
      { carrierType: "capability-feature-authoring-request.v1", featureReference },
      bindingUrl(root)
    );
    assert.throws(() => resolve("missing"), /FEATURE_NOT_FOUND/);
    assert.throws(() => resolve("not-feature.json"), /FEATURE_FILE_REQUIRED/);
    assert.throws(() => resolve(path.join(outside, "outside.feature")), /CANONICAL_FEATURE_OUTSIDE_GOVERNED_ROOT/);
    assert.throws(() => resolve("malformed.feature"), /CANONICAL_FEATURE_TAG_REQUIRED/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
