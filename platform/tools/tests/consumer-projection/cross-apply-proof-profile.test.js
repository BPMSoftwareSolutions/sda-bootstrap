"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
const { NodePlatformCapabilityRepository } = require("../../../artifacts/tools/dist/adapters/consumer-projection/node-platform-capability-repository.js");
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");

const WORKSPACE_ROOT = createReferenceWorkspace();
const CAPABILITY_DIGEST = `sha256:${crypto.createHash("sha256")
  .update(fs.readFileSync(path.join(WORKSPACE_ROOT, "capability.authority.json"), "utf8"))
  .digest("hex")}`;

function profile(overrides = {}) {
  return {
    proofProfileType: "consumer-cross-apply-proof-profile.v1",
    profileId: "generic-cross-apply.v1",
    capabilityId: "generic-consumer",
    capsuleDigest: `sha256:${"1".repeat(64)}`,
    capabilityAuthorityDigest: CAPABILITY_DIGEST,
    mandatoryTargets: ["node", "csharp", "python"],
    bindings: [],
    ...overrides
  };
}

test("Cross-Apply proof profile is closed and schema-admitted", () => {
  const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"));
  assert.equal(admission.validate(profile(), "consumer-cross-apply-proof-profile.schema.json").valid, true);
  assert.equal(admission.validate({
    ...profile(),
    bindings: [{
      target: "csharp",
      requestedCapabilityId: "model-port.v1",
      providerCapabilityId: "fixture-port.v1",
      executionMode: "unbounded-substitution"
    }]
  }, "consumer-cross-apply-proof-profile.schema.json").valid, false);
});

test("Cross-Apply profile supplies the mandatory target set and is retained in projection evidence", async () => {
  const proofProfile = profile({ mandatoryTargets: ["csharp", "node", "python"] });
  const result = await projectConsumerCapability(WORKSPACE_ROOT, {
    repositoryRoot: REPO_ROOT,
    projectionTargets: ["python", "csharp", "node"],
    proofProfile
  });
  assert.deepEqual(Object.keys(result.queries).sort(), ["csharp", "node", "python"]);
  assert.deepEqual(result.plan.proofProfile, proofProfile);
  const manifest = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "projected", "projection-manifest.json"), "utf8"));
  assert.deepEqual(manifest.proofProfile, proofProfile);
});

test("Cross-Apply rejects a capability identity or authority digest that did not produce the workspace", async () => {
  await assert.rejects(
    projectConsumerCapability(WORKSPACE_ROOT, {
      repositoryRoot: REPO_ROOT,
      proofProfile: profile({ capabilityId: "other-capability" })
    }),
    /CROSS_APPLY_CAPABILITY_ID_DIVERGED/
  );
  await assert.rejects(
    projectConsumerCapability(WORKSPACE_ROOT, {
      repositoryRoot: REPO_ROOT,
      proofProfile: profile({ capabilityAuthorityDigest: `sha256:${"2".repeat(64)}` })
    }),
    /CROSS_APPLY_CAPABILITY_AUTHORITY_DIGEST_DIVERGED/
  );
});

test("Cross-Apply rejects bindings outside mandatory targets and duplicate binding identities", async () => {
  const binding = {
    target: "csharp",
    requestedCapabilityId: "sda-generic-llm-connector-port.v1",
    providerCapabilityId: "sda-declarative-value-port.v1",
    executionMode: "fixture-port-outcomes-only"
  };
  await assert.rejects(
    projectConsumerCapability(WORKSPACE_ROOT, {
      repositoryRoot: REPO_ROOT,
      proofProfile: profile({ mandatoryTargets: ["node"], bindings: [binding] })
    }),
    /CROSS_APPLY_BINDING_TARGET_NOT_MANDATORY/
  );
  await assert.rejects(
    projectConsumerCapability(WORKSPACE_ROOT, {
      repositoryRoot: REPO_ROOT,
      proofProfile: profile({ bindings: [binding, { ...binding, providerCapabilityId: "different-provider.v1" }] })
    }),
    /CROSS_APPLY_BINDING_IDENTITY_DUPLICATED/
  );
});

test("fixture-only provider substitution is unavailable without the declared Cross-Apply profile", () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(
    REPO_ROOT,
    "kernel",
    "semantic-authority",
    "consumer",
    "sda-platform-capabilities.semantic-authority.json"
  ), "utf8"));
  const requirement = {
    mechanicId: "governed-model-invocation",
    capabilityKind: "event-port",
    requiredBy: "cross-apply-fixture",
    requestedCapabilityId: "sda-generic-llm-connector-port.v1"
  };
  assert.equal(new NodePlatformCapabilityRepository(REPO_ROOT).resolve(requirement, "csharp", catalog), null);
  const resolved = new NodePlatformCapabilityRepository(REPO_ROOT, profile({
    bindings: [{
      target: "csharp",
      requestedCapabilityId: "sda-generic-llm-connector-port.v1",
      providerCapabilityId: "sda-declarative-value-port.v1",
      executionMode: "fixture-port-outcomes-only"
    }]
  })).resolve(requirement, "csharp", catalog);
  assert.equal(resolved.capabilityId, "sda-declarative-value-port.v1");
  assert.equal(resolved.projectionTarget, "csharp");
});
