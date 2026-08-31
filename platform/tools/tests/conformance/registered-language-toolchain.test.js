"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { NodeLanguageToolchains } = require("../../../artifacts/tools/dist/adapters/conformance/language-toolchains.cjs");

const REPO_ROOT = path.resolve(__dirname, "../../..");

test("a registered argv target closes behavior and execution through its native toolchain profile", async () => {
  const target = "cpp";
  const binding = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "languages", target, "binding", `scenario-kernel-${target}.binding.json`), "utf8"));
  const toolchains = new NodeLanguageToolchains(REPO_ROOT);
  const behavior = toolchains.observeBehavior({ language: target, binding, status: "IMPLEMENTING", isActiveObligation: true });

  if (!behavior.toolchainAvailable) {
    assert.equal(behavior.ran, false);
    assert.equal(behavior.conforming, false);
    assert.match(behavior.reason, /native runtime target is not compatible with the current host/);
    const closure = await toolchains.observeExecutionClosure(target);
    assert.equal(closure.disposition, "NOT_OBSERVABLE");
    assert.match(closure.reason, /native runtime target is not compatible with the current host/);
    return;
  }

  assert.equal(behavior.ran, true);
  assert.equal(behavior.conforming, true);
  assert.equal(behavior.testsTotal, 5);
  assert.equal(behavior.testsPassed, 5);
  assert.match(behavior.summary, /NATIVE RUNTIME: compiler Apple Clang, target macOS-arm64, binary Mach-O, foreign-runtime NONE, semantic-delegation NONE/);

  const closure = await toolchains.observeExecutionClosure(target);
  assert.deepEqual(closure, {
    language: target,
    ran: true,
    conforming: true,
    disposition: "SATISFIED"
  });
});

test("a registered argv target closes its native consumer-platform circuit", async () => {
  const modulePath = path.join(REPO_ROOT, "artifacts", "tools", "dist", "adapters", "projection", "node-target-toolchain.js");
  const { NodeTargetToolchain } = await import(pathToFileURL(modulePath).href);
  const toolchain = new NodeTargetToolchain(REPO_ROOT, "cpp");
  const result = toolchain.proveConsumerPlatform();
  if (!toolchain.available()) {
    assert.equal(result.ran, false);
    assert.equal(result.conforming, false);
    assert.match(result.reason, /native runtime target is not compatible with the current host/);
    return;
  }
  assert.equal(result.ran, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.conforming, true);
  assert.equal(result.command, "Compile and execute the native C++ consumer-platform conformance circuit");
});

test("a registered argv target closes its native UI claimant circuit", async () => {
  const modulePath = path.join(REPO_ROOT, "artifacts", "tools", "dist", "adapters", "projection", "node-target-toolchain.js");
  const { NodeTargetToolchain } = await import(pathToFileURL(modulePath).href);
  const toolchain = new NodeTargetToolchain(REPO_ROOT, "cpp");
  const result = toolchain.proveUiClaimant();
  if (!toolchain.available()) {
    assert.equal(result.ran, false);
    assert.equal(result.conforming, false);
    assert.match(result.reason, /native runtime target is not compatible with the current host/);
    return;
  }
  assert.equal(result.ran, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.conforming, true);
  assert.equal(result.command, "Compile and execute the native C++ AppKit UI parity claimant");
  for (const suffix of ["testimony", "presentation-testimony", "wiring", "structural-testimony"]) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, "languages", "cpp", "build", "ui-parity-evidence", `cpp-appkit-${suffix}.json`)));
  }
});

test("registered source-inspection authority is admitted independently of checkout line endings", async () => {
  const registryModulePath = path.join(REPO_ROOT, "artifacts", "tools", "dist", "adapters", "projection", "node-language-target-registry.js");
  const { repositoryTextDigest } = await import(pathToFileURL(registryModulePath).href);
  assert.equal(repositoryTextDigest("authority\ntext\n"), repositoryTextDigest("authority\r\ntext\r\n"));

  const inspectorModulePath = path.join(REPO_ROOT, "artifacts", "tools", "dist", "adapters", "authority", "node-authority-source-inspector.js");
  const { NodeAuthoritySourceInspector } = await import(pathToFileURL(inspectorModulePath).href);
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "languages", "cpp", "conformance", "scenario-kernel-cpp.conformance.json"), "utf8"));
  const evidence = new NodeAuthoritySourceInspector(REPO_ROOT).inspect("cpp", manifest);
  assert.equal(evidence.conforming, true, JSON.stringify(evidence));
  assert.equal(evidence.checks.length, 8);
});
