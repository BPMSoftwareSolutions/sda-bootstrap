"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const PACKAGE_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "generate-ui-protocol-bindings");

test("one digest-bound model deterministically generates real sources for all eight language roots", async () => {
  const api = await import("../../../artifacts/tools/dist/ui-presentation/application/ui-protocol-binding-generator.js");
  const model = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "ui-protocol-binding-model.v1.json"), "utf8"));
  assert.equal(api.bindingModelDigest(model), model.modelDigest);
  const first = api.generateUiProtocolBindings(REPOSITORY_ROOT);
  const second = api.generateUiProtocolBindings(REPOSITORY_ROOT);
  assert.deepEqual(second, first);
  assert.deepEqual(first.map((item) => item.language), [
    "typescript", "csharp", "java", "kotlin", "swift", "cpp", "python", "go"
  ]);
  for (const binding of first) {
    const actual = fs.readFileSync(path.join(REPOSITORY_ROOT, binding.relativePath), "utf8");
    assert.equal(actual, binding.content, binding.relativePath);
    assert.match(actual, /generated from ui-protocol-binding-model\.v1/iu, binding.language);
    assert.match(actual, new RegExp(model.protocolSchemaDigest, "u"), binding.language);
    assert.match(actual, /digest.?canonical.?json/iu, binding.language);
    assert.match(actual, /ui.?capability.?requirement/iu, binding.language);
    assert.match(actual, /ui.?embodiment.?plan/iu, binding.language);
  }
});

test("generated digest helpers share one canonical UTF-8 fixture", async () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "fixtures", "canonical-json-digest.fixture.json"), "utf8"));
  const generated = await import("../../../languages/typescript/dist/src/generated/ui-protocol-v3.generated.js");
  assert.equal(generated.digestCanonicalJson(fixture.canonicalJson), fixture.digest);
  const sources = [
    "languages/csharp/src/ScenarioKernel.Contracts/Generated/UiProtocolV3.Generated.cs",
    "languages/java/src/main/java/scenario/kernel/generated/SdaUiProtocolV3.java",
    "languages/kotlin/presentation/android-compose/runtime/src/main/kotlin/scenario/kernel/generated/UiProtocolV3.generated.kt",
    "languages/swift/presentation/swiftui/Sources/ScenarioKernelSwiftUI/Generated/UiProtocolV3.generated.swift",
    "languages/cpp/generated/include/sda/ui_protocol_v3.generated.hpp",
    "languages/python/src/scenario_kernel/generated/ui_protocol_v3.py",
    "languages/go/generatedui/ui_protocol_v3.generated.go"
  ].map((relativePath) => fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8")).join("\n");
  assert.doesNotMatch(sources, /consumer-ui-authority|provider-registry\.v1|sda-ui-presentation-ir\.v2/iu);
});
