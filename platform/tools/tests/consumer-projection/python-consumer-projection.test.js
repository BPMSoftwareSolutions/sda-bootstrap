"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const WORKSPACE_ROOT = createReferenceWorkspace();
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");

test("Python projects and executes unchanged generic consumer authority", { timeout: 120000 }, async (t) => {
  const executable = path.join(REPO_ROOT, "languages", "python", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!fs.existsSync(executable)) return t.skip("required project Python toolchain is not available");
  const projection = await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT, projectionTargets: ["node", "python"] });
  const seam = path.join(WORKSPACE_ROOT, "projected", "python", "consumer.generated.py");
  assert.equal(projection.mechanicResolutions.python.disposition, "RESOLVED");
  assert.ok(fs.existsSync(seam));
  const sourceRoot = path.join(REPO_ROOT, "languages", "python", "src");
  const execution = spawnSync(executable, [seam, "--test"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120000, env: { ...process.env, PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) } });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
  const proof = JSON.parse(execution.stdout.trim().split(/\r?\n/).at(-1));
  assert.equal(proof.projectionTarget, "python");
  assert.equal(proof.mechanicResolution, "RESOLVED");
  assert.equal(proof.executableOrigin, "PROJECTED_ONLY");
  assert.ok(proof.fixtures.every((fixture) => fixture.disposition === "PASS"));
  assert.equal(proof.disposition, "ADMITTED");
});

test("Python semantic length matches the canonical string and array behavior", (t) => {
  const executable = path.join(REPO_ROOT, "languages", "python", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!fs.existsSync(executable)) return t.skip("required project Python toolchain is not available");
  const sourceRoot = path.join(REPO_ROOT, "languages", "python", "src");
  const program = [
    "from scenario_kernel.adapters import SemanticTransformationEngine",
    "engine = SemanticTransformationEngine()",
    "assert engine.transform({'op':'length','value':{'op':'literal','value':'abc'}}, {}) == 3",
    "assert engine.transform({'op':'length','value':{'op':'literal','value':[1,2]}}, {}) == 2"
  ].join("; ");
  const execution = spawnSync(executable, ["-c", program], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) }
  });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("Python semantic includes matches canonical string and array behavior", (t) => {
  const executable = path.join(REPO_ROOT, "languages", "python", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!fs.existsSync(executable)) return t.skip("required project Python toolchain is not available");
  const sourceRoot = path.join(REPO_ROOT, "languages", "python", "src");
  const program = [
    "from scenario_kernel.adapters import SemanticTransformationEngine",
    "engine = SemanticTransformationEngine()",
    "assert engine.transform({'op':'includes','in':{'op':'literal','value':'if (value)'},'value':{'op':'literal','value':'if ('}}, {}) is True",
    "assert engine.transform({'op':'includes','in':{'op':'literal','value':['branch','throw']},'value':{'op':'literal','value':'throw'}}, {}) is True"
  ].join("; ");
  const execution = spawnSync(executable, ["-c", program], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, PYTHONPATH: [sourceRoot, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) }
  });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});
