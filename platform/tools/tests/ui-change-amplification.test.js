"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateUiChangeAmplification } = require("../../artifacts/tools/dist/governance/ui-change-amplification.js");

const REPO_ROOT = path.resolve(__dirname, "../..");
const policy = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "governance", "ui", "change-amplification-policy.json"), "utf8"));
const declaration = (changeClass, targets = []) => ({ declarationType: "sda-ui-change-declaration.v1", changeClass, description: "test", targets });

test("consumer data-only UI changes cannot amplify into central tooling", () => {
  const evidence = evaluateUiChangeAmplification(policy, declaration("CONSUMER_UI_DATA_ONLY"), [
    "examples/generic-capability/ui.authority.json",
    "governance/ui/current-change.json",
    "tools/src/ui-parity/application/ui-parity-projector.ts"
  ]);
  assert.equal(evidence.disposition, "CHANGE_AMPLIFICATION_VIOLATION");
  assert.deepEqual(evidence.unexpectedPaths, ["tools/src/ui-parity/application/ui-parity-projector.ts"]);
});

test("a named target provider change cannot spill into an unrelated provider", () => {
  const evidence = evaluateUiChangeAmplification(policy, declaration("TARGET_PROVIDER_EVOLUTION", ["wpf"]), [
    "governance/ui/current-change.json",
    "languages/csharp/src/ScenarioKernel.Wpf/UiOperationExecutor.cs",
    "languages/typescript/presentation/react/runtime/authority-backed-application.mjs"
  ]);
  assert.equal(evidence.disposition, "CHANGE_AMPLIFICATION_VIOLATION");
  assert.deepEqual(evidence.unexpectedPaths, ["languages/typescript/presentation/react/runtime/authority-backed-application.mjs"]);

  const nativeEvidence = evaluateUiChangeAmplification(policy, declaration("TARGET_PROVIDER_EVOLUTION", ["cpp-appkit"]), [
    "governance/ui/current-change.json",
    "languages/cpp/ui/authority_backed_appkit_application.cpp",
    "languages/cpp/conformance/ui_parity_test.cpp"
  ]);
  assert.equal(nativeEvidence.disposition, "PASS");
});

test("protocol evolution and non-UI changes receive deterministic dispositions", () => {
  assert.equal(evaluateUiChangeAmplification(policy, declaration("UI_PROTOCOL_EVOLUTION"), [
    "capabilities/sda-platform/ui-embodiment/feature-capabilities.json",
    "governance/ui/current-change.json",
    "tools/src/ui-parity/proof/ui-feature-admission.ts"
  ]).disposition, "PASS");
  assert.equal(evaluateUiChangeAmplification(policy, null, ["docs/README.md"]).disposition, "NOT_APPLICABLE");
  assert.equal(evaluateUiChangeAmplification(policy, null, ["examples/generic-capability/ui.authority.json"]).disposition, "CHANGE_AMPLIFICATION_VIOLATION");
  assert.deepEqual(evaluateUiChangeAmplification(policy, declaration("CONSUMER_UI_DATA_ONLY"), [
    "examples/generic-capability/ui.authority.json"
  ]).unexpectedPaths, ["governance/ui/current-change.json"]);
});
