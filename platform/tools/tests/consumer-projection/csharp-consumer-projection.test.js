"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const WORKSPACE_ROOT = createReferenceWorkspace();
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");

test("C# projects and executes unchanged generic consumer authority", { timeout: 120000 }, async (t) => {
  const availability = spawnSync("dotnet", ["--version"], { cwd: REPO_ROOT, encoding: "utf8" });
  if (availability.error || availability.status !== 0) return t.skip("required dotnet toolchain is not available");
  const projection = await projectConsumerCapability(WORKSPACE_ROOT, { repositoryRoot: REPO_ROOT, projectionTargets: ["node", "csharp"] });
  const project = path.join(WORKSPACE_ROOT, "projected", "csharp", "ProjectedConsumerCli.generated.csproj");
  const isolatedBuildRoot = path.join(WORKSPACE_ROOT, "csharp-projection-build");
  assert.equal(projection.mechanicResolutions.csharp.disposition, "RESOLVED");
  assert.ok(fs.existsSync(project));
  const buildProps = fs.readFileSync(path.join(WORKSPACE_ROOT, "projected", "csharp", "Directory.Build.props"), "utf8");
  assert.match(buildProps, /artifacts\\cb\\[a-f0-9]{16}/u, "default C# build output uses a bounded content-derived cache address");
  const execution = spawnSync("dotnet", [
    "run", "--project", project, "--disable-build-servers",
    `-p:SdaConsumerProjectionBuildRoot=${isolatedBuildRoot}`, "--", "--test"
  ], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120000 });
  spawnSync("dotnet", ["build-server", "shutdown"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 30000 });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
  const proof = JSON.parse(execution.stdout.trim().split(/\r?\n/).at(-1));
  assert.equal(proof.projectionTarget, "csharp");
  assert.equal(proof.mechanicResolution, "RESOLVED");
  assert.equal(proof.executableOrigin, "PROJECTED_ONLY");
  assert.ok(proof.fixtures.every((fixture) => fixture.disposition === "PASS"));
  assert.equal(proof.disposition, "ADMITTED");
});
