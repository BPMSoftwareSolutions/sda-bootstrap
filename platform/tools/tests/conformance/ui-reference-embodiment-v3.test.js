"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../../..");
const PLATFORM = path.join(ROOT, "capabilities", "sda-platform");
const PROVIDER_ROOT = path.join(PLATFORM, "resolve-ui-embodiment-provider");
const MATERIALIZE_ROOT = path.join(PLATFORM, "materialize-ui-embodiment");

function json(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

async function subject() {
  const planner = await import("../../../artifacts/tools/dist/ui-presentation/application/ui-embodiment-planner.js");
  const semantic = await import("../../../artifacts/tools/dist/ui-presentation/application/declared-ui-presentation-resolver.js");
  const compiler = await import("../../../artifacts/tools/dist/ui-presentation/application/semantic-presentation-compiler.js");
  const react = await import("../../../languages/typescript/presentation/react/runtime/v3-plan-embodiment.mjs");
  const dom = await import("../../../languages/typescript/presentation/browser-dom/runtime/v3-plan-embodiment.mjs");
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const declaration = json("capabilities/sda-platform/resolve-declared-ui-presentation/fixtures/minimal.declared-ui-authority.json");
  const presentation = semantic.resolveDeclaredUiPresentation(declaration).presentation;
  const ir = json("capabilities/sda-platform/ui-presentation-protocol/fixtures/v3-compiled/minimal.sda-ui-presentation-ir.v3.json");
  const registry = json("capabilities/sda-platform/resolve-ui-embodiment-provider/provider-registry.v2.json");
  return {
    planner,
    semantic,
    compiler,
    react,
    dom,
    presentation,
    ir,
    registry,
    compilerAuthority: json("capabilities/sda-platform/compile-semantic-presentation/compile-semantic-presentation.authority.json"),
    reactProfile: json("capabilities/sda-platform/resolve-ui-embodiment-provider/fixtures/react-web.ui-target-profile.v1.json"),
    domProfile: json("capabilities/sda-platform/resolve-ui-embodiment-provider/fixtures/browser-dom-web.ui-target-profile.v1.json"),
    testimonyAdmission: new AjvSchemaAdmission(path.join(MATERIALIZE_ROOT, "contracts"))
  };
}

function planFor(api, presentation, ir, profile) {
  const vector = api.planner.resolveUiEmbodimentRequirements(ir);
  const result = api.planner.planUiEmbodiment(presentation, ir, vector, profile, api.registry);
  assert.equal(result.resolution.disposition, "SELECTED");
  return result.plan;
}

function comparableProjection(projection) {
  return {
    rootNodeRefs: projection.rootNodeRefs,
    elements: projection.elements,
    nodes: projection.nodes,
    adaptations: projection.adaptations,
    profileRefs: projection.profileRefs,
    tokenRefs: projection.tokenRefs
  };
}

test("Phase H admits two reference providers above one shared plan interpreter", async () => {
  const api = await subject();
  assert.deepEqual(api.testimonyAdmission.unresolvedSchemaFiles(), []);
  for (const profile of [api.reactProfile, api.domProfile]) {
    assert.equal(api.planner.targetProfileDigest(profile), profile.canonicalDigest);
  }
  assert.equal(api.planner.providerCatalogDigest(api.registry), api.registry.catalogDigest);
  for (const provider of api.registry.providers) {
    assert.equal(api.planner.providerDigest(provider), provider.providerDigest, provider.providerId);
    assert.equal(fs.existsSync(path.join(ROOT, provider.implementationRef)), true, provider.providerId);
  }
  const admitted = api.registry.providers.filter((provider) =>
    provider.admissionStatus === "PROVIDER_ADMITTED" &&
    provider.targetKinds.some((targetKind) => ["browser-dom-web", "react-web"].includes(targetKind))
  );
  assert.deepEqual(admitted.map((provider) => provider.providerId), [
    "sda-browser-dom-v3-embodiment-provider.v1",
    "sda-react-v3-embodiment-provider.v1"
  ]);
  assert.ok(admitted.every((provider) => provider.observationCapability === "STRUCTURAL"));
  assert.ok(admitted.every((provider) => provider.admissionStatus !== "NATIVE_PROOF_ADMITTED"));
});

test("React and browser DOM apply equivalent successor instructions with semantic testimony", async () => {
  const api = await subject();
  const reactPlan = planFor(api, api.presentation, api.ir, api.reactProfile);
  const domPlan = planFor(api, api.presentation, api.ir, api.domProfile);
  assert.deepEqual(reactPlan.instructions, domPlan.instructions);
  assert.deepEqual(reactPlan.rootNodeRefs, domPlan.rootNodeRefs);

  const reactProjection = api.react.applyReactUiEmbodimentPlan(reactPlan);
  const domProjection = api.dom.applyBrowserDomUiEmbodimentPlan(domPlan);
  assert.deepEqual(comparableProjection(reactProjection), comparableProjection(domProjection));
  const action = reactProjection.elements.find((element) => element.semanticElementRef === "action.resolve");
  const feedback = reactProjection.elements.find((element) => element.semanticElementRef === "feedback.resolution-status");
  const information = reactProjection.elements.find((element) => element.semanticElementRef === "information.result");
  assert.equal(action.nativeRole, "button");
  assert.deepEqual(action.eventBindings.map((binding) => binding.semanticEventRef), ["event.resolve"]);
  assert.deepEqual(action.accessibilityObligations.map((item) => item.obligationKind), ["OPERABLE_ACTION"]);
  assert.equal(feedback.nativeRole, "output");
  assert.deepEqual(feedback.accessibilityObligations.map((item) => item.obligationKind), ["LIVE_FEEDBACK"]);
  assert.equal(information.content.kind, "READ_MODEL_REF");
  assert.equal(information.content.value, "read-model.result");
  assert.deepEqual(reactProjection.adaptations.map((item) => item.operationKind), ["GROUPING", "ORDER"]);

  const dispatched = [];
  const React = { createElement: (type, properties, ...children) => ({ type, properties, children }) };
  const reactNative = api.react.materializeReactUiEmbodiment(reactPlan, React, {
    readModel: { "read-model.result": "Result", "read-model.resolution-status": "Ready" },
    dispatch: (eventRef) => dispatched.push(eventRef)
  });
  assert.equal(reactNative.roots[0].type, "div");
  assert.deepEqual(reactNative.roots[0].children.map((child) => child.type), ["button", "output", "p"]);
  assert.equal(reactNative.roots[0].children[1].properties["aria-live"], "polite");
  reactNative.roots[0].children[0].properties.onClick();

  const document = {
    createElement(type) {
      return {
        type,
        attributes: {},
        children: [],
        listeners: {},
        textContent: "",
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, listener) { this.listeners[name] = listener; },
        append(child) { this.children.push(child); }
      };
    }
  };
  const domNative = api.dom.materializeBrowserDomUiEmbodiment(domPlan, document, {
    readModel: { "read-model.result": "Result", "read-model.resolution-status": "Ready" },
    dispatch: (eventRef) => dispatched.push(eventRef)
  });
  assert.equal(domNative.roots[0].type, "div");
  assert.deepEqual(domNative.roots[0].children.map((child) => child.type), ["button", "output", "p"]);
  assert.equal(domNative.roots[0].children[1].attributes["aria-live"], "polite");
  domNative.roots[0].children[0].listeners.click();
  assert.deepEqual(dispatched, ["event.resolve", "event.resolve"]);

  for (const testimony of [
    api.react.observeReactUiEmbodiment(reactProjection),
    api.dom.observeBrowserDomUiEmbodiment(domProjection)
  ]) {
    assert.equal(api.testimonyAdmission.validate(testimony, "ui-embodiment-structural-testimony.v1.schema.json").valid, true);
    assert.equal(testimony.disposition, "STRUCTURALLY_CONFORMANT");
    assert.deepEqual(testimony.findings, []);
  }
});

test("authority deletion removes target elements in both providers without repair invention", async () => {
  const api = await subject();
  const deletion = json("capabilities/sda-platform/resolve-declared-ui-presentation/fixtures/deletion.declared-ui-authority.json");
  const presentation = api.semantic.resolveDeclaredUiPresentation(deletion).presentation;
  const compiled = api.compiler.compileSemanticPresentation(presentation, api.compilerAuthority);
  assert.equal(compiled.evidence.disposition, "COMPILED");
  const reactPlan = planFor(api, presentation, compiled.ir, api.reactProfile);
  const domPlan = planFor(api, presentation, compiled.ir, api.domProfile);
  const reactProjection = api.react.applyReactUiEmbodimentPlan(reactPlan);
  const domProjection = api.dom.applyBrowserDomUiEmbodimentPlan(domPlan);
  assert.deepEqual(comparableProjection(reactProjection), comparableProjection(domProjection));
  assert.deepEqual(reactProjection.elements.map((element) => element.semanticElementRef), ["information.result"]);
  assert.deepEqual(reactProjection.elements.flatMap((element) => element.eventBindings), []);
  assert.deepEqual(reactProjection.adaptations, []);
  assert.doesNotMatch(JSON.stringify(reactProjection), /action\.resolve|feedback\.resolution-status|Resolve/u);
});

test("successor provider sources are sterile plan consumers", () => {
  const files = [
    "languages/typescript/runtimes/browser/runtime/ui-embodiment-plan-v1.mjs",
    "languages/typescript/presentation/react/runtime/v3-plan-embodiment.mjs",
    "languages/typescript/presentation/browser-dom/runtime/v3-plan-embodiment.mjs"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(source, /consumer-ui-authority|sda-ui-presentation-ir\.v2|consumerRecipe|status algorithm|invented chrome/iu, file);
    assert.doesNotMatch(source, /\bResolve\b/u, file);
  }
});
