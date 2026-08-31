"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const WORKSPACE_ROOT = createReferenceWorkspace();
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");
const { observeConsumerExperienceClosure } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/assure.js");

test("a promised experience closes only through observed runtime conditions", async () => {
  const compilation = await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT, projectionTargets: ["node"] });
  const result = await observeConsumerExperienceClosure(REPO_ROOT, WORKSPACE_ROOT, compilation);
  const proof = result.closure.evidence;
  assert.equal(proof.disposition, "OBSERVABLY_TRUE");
  assert.ok(proof.fixtures.every((fixture) => fixture.disposition === "EXPERIENCE_REALIZED"));
  assert.ok(proof.fixtures.flatMap((fixture) => fixture.conditions).every((condition) => condition.disposition === "OBSERVED"));
  assert.deepEqual(result.conditionIds, ["consumer-experience-is-realized-by-observed-runtime-outcomes"]);
});
