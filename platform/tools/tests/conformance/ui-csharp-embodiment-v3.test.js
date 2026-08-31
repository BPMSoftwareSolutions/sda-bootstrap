"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const PLATFORM = path.join(ROOT, "capabilities", "sda-platform");

function json(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

async function subject(declarationName = "minimal") {
  const planner = await import("../../../artifacts/tools/dist/ui-presentation/application/ui-embodiment-planner.js");
  const semantic = await import("../../../artifacts/tools/dist/ui-presentation/application/declared-ui-presentation-resolver.js");
  const compiler = await import("../../../artifacts/tools/dist/ui-presentation/application/semantic-presentation-compiler.js");
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const declaration = json(`capabilities/sda-platform/resolve-declared-ui-presentation/fixtures/${declarationName}.declared-ui-authority.json`);
  const presentation = semantic.resolveDeclaredUiPresentation(declaration).presentation;
  const authority = json("capabilities/sda-platform/compile-semantic-presentation/compile-semantic-presentation.authority.json");
  const ir = declarationName === "minimal"
    ? json("capabilities/sda-platform/ui-presentation-protocol/fixtures/v3-compiled/minimal.sda-ui-presentation-ir.v3.json")
    : compiler.compileSemanticPresentation(presentation, authority).ir;
  return {
    planner,
    presentation,
    ir,
    registry: json("capabilities/sda-platform/resolve-ui-embodiment-provider/provider-registry.v2.json"),
    planAdmission: new AjvSchemaAdmission(path.join(PLATFORM, "plan-ui-embodiment", "contracts")),
    providerAdmission: new AjvSchemaAdmission(path.join(PLATFORM, "resolve-ui-embodiment-provider", "contracts")),
    profiles: {
      wpf: json("capabilities/sda-platform/resolve-ui-embodiment-provider/fixtures/wpf-v3.ui-target-profile.v1.json"),
      avalonia: json("capabilities/sda-platform/resolve-ui-embodiment-provider/fixtures/avalonia-v3.ui-target-profile.v1.json")
    }
  };
}

function plan(api, profile) {
  const vector = api.planner.resolveUiEmbodimentRequirements(api.ir);
  return api.planner.planUiEmbodiment(api.presentation, api.ir, vector, profile, api.registry).plan;
}

function normalizedInstructions(value) {
  return value.instructions.map((instruction) => ({
    ...instruction,
    mechanicId: instruction.mechanicId.replace(/^(?:csharp|web)\./u, "target.")
  }));
}

test("Phase I C# providers resolve deterministically and share one instruction circuit", async () => {
  const api = await subject();
  const wpf = plan(api, api.profiles.wpf);
  const avalonia = plan(api, api.profiles.avalonia);
  const reactProfile = json("capabilities/sda-platform/resolve-ui-embodiment-provider/fixtures/react-web.ui-target-profile.v1.json");
  const react = plan(api, reactProfile);
  assert.equal(api.providerAdmission.validate(api.registry, "ui-embodiment-provider-registry.v2.schema.json").valid, true);
  assert.equal(api.providerAdmission.validate(api.profiles.wpf, "ui-target-profile.v1.schema.json").valid, true);
  assert.equal(api.providerAdmission.validate(api.profiles.avalonia, "ui-target-profile.v1.schema.json").valid, true);
  assert.equal(api.planAdmission.validate(wpf, "ui-embodiment-plan.v1.schema.json").valid, true);
  assert.equal(api.planAdmission.validate(avalonia, "ui-embodiment-plan.v1.schema.json").valid, true);
  assert.equal(wpf.providerId, "sda-wpf-v3-embodiment-provider.v1");
  assert.equal(avalonia.providerId, "sda-avalonia-v3-embodiment-provider.v1");
  assert.deepEqual(wpf.instructions, avalonia.instructions);
  assert.deepEqual(normalizedInstructions(wpf), normalizedInstructions(react));
  assert.deepEqual(wpf, json("capabilities/sda-platform/plan-ui-embodiment/fixtures/minimal.wpf-v3.ui-embodiment-plan.v1.json"));
  assert.deepEqual(avalonia, json("capabilities/sda-platform/plan-ui-embodiment/fixtures/minimal.avalonia-v3.ui-embodiment-plan.v1.json"));
});

test("authority deletion deterministically removes C# action and feedback instructions", async () => {
  const api = await subject("deletion");
  for (const [target, profile] of Object.entries(api.profiles)) {
    const projected = plan(api, profile);
    assert.deepEqual(projected.instructions.filter((item) => item.instructionKind === "REALIZE_SEMANTIC_ELEMENT").map((item) => item.sourceRef), ["information.result"]);
    assert.doesNotMatch(JSON.stringify(projected), /action\.resolve|feedback\.resolution-status|Resolve/u);
    assert.deepEqual(projected, json(`capabilities/sda-platform/plan-ui-embodiment/fixtures/deletion.${target === "wpf" ? "wpf-v3" : "avalonia-v3"}.ui-embodiment-plan.v1.json`));
  }
});

test("C# successor path consumes plans without legacy authority vocabulary", () => {
  const files = [
    "languages/csharp/src/ScenarioKernel.UiEmbodiment/UiEmbodimentPlan.cs",
    "languages/csharp/src/ScenarioKernel.Wpf/V3PlanEmbodiment.cs",
    "languages/csharp/src/ScenarioKernel.Avalonia/V3PlanEmbodiment.cs"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(source, /consumer-ui-authority|sda-ui-presentation-ir\.v2|ConsumerUiApplication|consumerRecipe|\bResolve\b/iu, file);
  }
});
