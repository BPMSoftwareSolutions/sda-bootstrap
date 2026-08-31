"use strict";
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const WORKSPACE_ROOT = createReferenceWorkspace();
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");
const { validateProjectedMechanicalSterility, evaluateMechanicalSterility } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/assure.js");
const { NodeConsumerApplicationProvider, resolvePlatformRuntimeRef } = require("../../../artifacts/tools/dist/consumer-projection/providers/node/consumer-application-provider.js");

test("every projected executable artifact is a mechanically sterile seam", async () => {
  const compilation = await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT });
  const result = await validateProjectedMechanicalSterility(REPO_ROOT, compilation);
  assert.equal(result.closure.evidence.disposition, "PURE_PROJECTION_CONFORMS");
  assert.ok(Object.values(result.closure.evidence.forbiddenExecutableMechanics).every((count) => count === 0));
});

test("a projected branch, loop, throw, or serializer is an admission violation", () => {
  const content = "if (value) { for (const item of values) { throw new Error(JSON.stringify(item)); } }\n";
  const evidence = evaluateMechanicalSterility([{ relativePath: "node/impure.generated.mjs", content, digest: "unused", sourcePointers: ["test"], target: "node" }]);
  assert.equal(evidence.disposition, "PROJECTED_EXECUTION_MECHANIC_VIOLATION");
  for (const mechanic of ["branch", "iteration", "throw", "object-construction", "serialization"]) {
    assert.ok(evidence.forbiddenExecutableMechanics[mechanic] > 0, `expected ${mechanic} violation`);
  }
});

test("projected WPF markup rejects behavioral escape hatches", () => {
  const content = `<!-- GENERATED PURE UI PROJECTION. Do not hand-edit. -->\n<Button Click="RunDomainLogic" />\n`;
  const evidence = evaluateMechanicalSterility([{ relativePath: "csharp/MainWindow.generated.xaml", content, digest: "unused", sourcePointers: ["test"], target: "csharp" }]);
  assert.equal(evidence.disposition, "PROJECTED_EXECUTION_MECHANIC_VIOLATION");
  assert.ok(evidence.forbiddenExecutableMechanics["meaning-hidden-in-text"] > 0);
});

test("sterile seams resolve the admitted platform from an external consumer workspace", () => {
  const externalRoot = path.join(path.parse(REPO_ROOT).root, "external-consumer-workspace");
  const nodeDir = path.join(externalRoot, "projected", "node");
  const reference = resolvePlatformRuntimeRef(REPO_ROOT, nodeDir);
  assert.ok(reference.startsWith("file:") || reference.includes("languages/typescript/runtimes/node/admitted-consumer-platform.mjs"));
  const files = new NodeConsumerApplicationProvider().render({
    repositoryRoot: REPO_ROOT,
    workspaceRoot: externalRoot,
    capabilityId: "external-capability",
    interfaceAuthority: { interfaceAuthorityType: "consumer-interface-authority.v1", contractValidatorCapabilityId: "validator", interfaces: [{ interfaceId: "external-cli", kind: "cli", rootScenarioId: "scenario-a", platformCapabilityId: "cli" }], portBindings: [], projectionBindings: [] },
    query: {}
  });
  assert.equal(evaluateMechanicalSterility(files).disposition, "PURE_PROJECTION_CONFORMS");
});
