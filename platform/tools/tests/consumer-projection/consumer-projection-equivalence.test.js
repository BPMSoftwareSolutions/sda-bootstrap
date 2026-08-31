"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const WORKSPACE_ROOT = createReferenceWorkspace();
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");
const { observeConsumerProjectionEquivalence } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/assure.js");

test("cross-runtime equivalence authority is schema-admitted", () => {
  const authority = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "consumer-projection-equivalence.semantic-authority.json"), "utf8"));
  const result = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas")).validate(authority, "consumer-projection-equivalence-authority.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
});

test("three projected runtimes preserve canonical outcome and scenario lineage", { timeout: 180000 }, async (t) => {
  const dotnet = spawnSync("dotnet", ["--version"], { cwd: REPO_ROOT, encoding: "utf8" });
  const python = path.join(REPO_ROOT, "languages", "python", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (dotnet.error || dotnet.status !== 0 || !fs.existsSync(python)) return t.skip("C# and Python toolchains are required");
  const compilation = await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT, projectionTargets: ["node", "csharp", "python"] });
  const result = await observeConsumerProjectionEquivalence(REPO_ROOT, WORKSPACE_ROOT, compilation, ["node", "csharp", "python"]);
  const proof = result.closure.evidence;
  assert.equal(proof.disposition, "BEHAVIORALLY_EQUIVALENT");
  assert.equal(proof.fixtures.length, 1);
  assert.ok(proof.fixtures.every((fixture) => fixture.disposition === "EQUIVALENT"));
  assert.ok(proof.fixtures.flatMap((fixture) => fixture.targets).every((target) => target.outcomeEquivalent && target.lineageEquivalent));
  assert.equal(result.providerId, "typescript-cross-target-equivalence-provider.v1");
});
