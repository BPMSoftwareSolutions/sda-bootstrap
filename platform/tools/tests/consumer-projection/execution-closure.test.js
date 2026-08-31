"use strict";
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const WORKSPACE_ROOT = createReferenceWorkspace();
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");

test("authority alone projects an executable consumer runtime, query, telemetry, and passing tests", async () => {
  const result = await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT });
  assert.equal(result.query.queryType, "projected-consumer-conformance-query.v1");
  assert.equal(result.expectedTelemetry.scenarios.length, result.scenarios.length);
  const projectedTest = path.join(WORKSPACE_ROOT, "projected", "node", "capability.projected.test.mjs");
  const run = spawnSync(process.execPath, ["--test", projectedTest], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120000 });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const cli = spawnSync(process.execPath, [path.join(WORKSPACE_ROOT, "projected", "node", "generic-cli.generated.mjs"), JSON.stringify({ value: "interface-input" })], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120000 });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  const delivered = JSON.parse(cli.stdout);
  assert.equal(delivered.disposition, "terminated");
  assert.deepEqual(delivered.executions.map((execution) => execution.scenarioId), ["scenario-a", "scenario-b"]);
});
