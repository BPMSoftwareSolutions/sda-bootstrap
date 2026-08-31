"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");
const { REPO_ROOT, createReferenceWorkspace } = require("./reference-workspace.cjs");
const WORKSPACE_ROOT = createReferenceWorkspace();
const { projectConsumerCapability } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/project.js");

test("C# WPF application is projected from UI authority and resolves every UI mechanic", { timeout: 180000 }, async (t) => {
  if (process.platform !== "win32") return t.skip("WPF runtime conformance requires Windows");
  const availability = spawnSync("dotnet", ["--version"], { cwd: REPO_ROOT, encoding: "utf8" });
  if (availability.error || availability.status !== 0) return t.skip("required dotnet toolchain is not available");

  const projection = await projectConsumerCapability(WORKSPACE_ROOT, {
    repositoryRoot: REPO_ROOT,
    projectionTargets: ["node", "csharp"]
  });
  const resolution = projection.mechanicResolutions.csharp;
  const requiredUiMechanics = [
    "ui-delivery",
    "wpf-application-hosting",
    "declarative-view-materialization",
    "observable-view-state",
    "authority-binding-projection",
    "generic-command-dispatch",
    "experience-authority-projection",
    "interaction-authority-projection",
    "semantic-layout-projection",
    "accessibility-intent-projection",
    "validation-semantic-enforcement",
    "fixture-input-delivery",
    "scenario-command-dispatch",
    "query-command-dispatch",
    "cancellation-command-dispatch"
  ];
  for (const mechanic of requiredUiMechanics) {
    const finding = resolution.resolutions.find((candidate) => candidate.mechanicId === mechanic);
    assert.equal(finding?.status, "AVAILABLE", mechanic);
    assert.equal(finding?.capabilityId, "sda-wpf-ui.v1", mechanic);
  }

  const projected = path.join(WORKSPACE_ROOT, "projected", "csharp");
  const project = path.join(projected, "ProjectedConsumerWpf.generated.csproj");
  const isolatedBuildRoot = path.join(WORKSPACE_ROOT, "csharp-projection-build");
  const xaml = fs.readFileSync(path.join(projected, "MainWindow.generated.xaml"), "utf8");
  const viewModel = fs.readFileSync(path.join(projected, "ProjectedUiViewModel.generated.cs"), "utf8");
  const uiAuthority = JSON.parse(fs.readFileSync(path.join(projected, "ui", "ui-authority.csharp.json"), "utf8"));
  assert.ok(fs.existsSync(project));
  assert.match(xaml, /^<!-- GENERATED PURE UI PROJECTION/);
  assert.match(xaml, /Command="\{Binding Commands\[execute-generic-capability\]\}"/);
  assert.match(xaml, /Command="\{Binding Commands\[query-terminal-outcome\]\}"/);
  for (const input of uiAuthority.interactionAuthority.inputs) {
    assert.ok(xaml.includes(`Inputs[${input.stateId}]`), `input:${input.inputId}`);
    assert.ok(xaml.includes(`AutomationProperties.Name="${input.accessibility.name}"`), `accessibility:${input.inputId}`);
  }
  for (const action of uiAuthority.interactionAuthority.actions) {
    assert.ok(xaml.includes(`Commands[${action.actionId}]`), `action:${action.actionId}`);
    assert.ok(xaml.includes(`AutomationProperties.Name="${action.accessibility.name}"`), `accessibility:${action.actionId}`);
  }
  assert.doesNotMatch(xaml, /(?:Click=|x:Code|Converter=|DataTrigger|ObjectDataProvider)/);
  assert.match(viewModel, /: AuthorityBackedViewModel/);

  const build = spawnSync("dotnet", [
    "build", project, "--nologo", "--disable-build-servers",
    `-p:SdaConsumerProjectionBuildRoot=${isolatedBuildRoot}`
  ], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 180000
  });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const runtimeTestProject = path.join(
    REPO_ROOT,
    "languages", "csharp", "tests", "ScenarioKernel.Wpf.ConformanceTests",
    "ScenarioKernel.Wpf.ConformanceTests.csproj"
  );
  const runtimeTest = spawnSync("dotnet", ["test", runtimeTestProject, "--nologo"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 180000,
    env: { ...process.env, SDA_WPF_CONFORMANCE_WORKSPACE: WORKSPACE_ROOT }
  });
  spawnSync("dotnet", ["build-server", "shutdown"], { cwd: REPO_ROOT, encoding: "utf8", timeout: 30000 });
  assert.equal(runtimeTest.status, 0, `${runtimeTest.stderr}\n${runtimeTest.stdout}`.trim());
});
