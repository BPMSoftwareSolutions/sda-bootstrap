"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const REQUIREMENTS_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "resolve-ui-embodiment-requirements");
const PROVIDER_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "resolve-ui-embodiment-provider");
const PLAN_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "plan-ui-embodiment");
const PROTOCOL_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "ui-presentation-protocol");
const DECLARATION_ROOT = path.join(REPOSITORY_ROOT, "capabilities", "sda-platform", "resolve-declared-ui-presentation");

function json(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function subject() {
  const api = await import("../../../artifacts/tools/dist/ui-presentation/application/ui-embodiment-planner.js");
  const semanticApi = await import("../../../artifacts/tools/dist/ui-presentation/application/declared-ui-presentation-resolver.js");
  const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
  const declaration = json(path.join(DECLARATION_ROOT, "fixtures", "minimal.declared-ui-authority.json"));
  return {
    ...api,
    requirementsAdmission: new AjvSchemaAdmission(path.join(REQUIREMENTS_ROOT, "contracts")),
    providerAdmission: new AjvSchemaAdmission(path.join(PROVIDER_ROOT, "contracts")),
    planAdmission: new AjvSchemaAdmission(path.join(PLAN_ROOT, "contracts")),
    ir: json(path.join(PROTOCOL_ROOT, "fixtures", "v3-compiled", "minimal.sda-ui-presentation-ir.v3.json")),
    presentation: semanticApi.resolveDeclaredUiPresentation(declaration).presentation,
    profile: json(path.join(PROVIDER_ROOT, "fixtures", "headless-proof.ui-target-profile.v1.json")),
    registry: json(path.join(PROVIDER_ROOT, "provider-registry.v2.json"))
  };
}

test("Phase F contracts and catalog are closed, digest-bound, and target-neutral", async () => {
  const api = await subject();
  assert.deepEqual(api.requirementsAdmission.unresolvedSchemaFiles(), []);
  assert.deepEqual(api.providerAdmission.unresolvedSchemaFiles(), []);
  assert.deepEqual(api.planAdmission.unresolvedSchemaFiles(), []);
  assert.equal(api.providerAdmission.validate(api.profile, "ui-target-profile.v1.schema.json").valid, true);
  assert.equal(api.providerAdmission.validate(api.registry, "ui-embodiment-provider-registry.v2.schema.json").valid, true);
  assert.equal(api.targetProfileDigest(api.profile), api.profile.canonicalDigest);
  assert.equal(api.providerCatalogDigest(api.registry), api.registry.catalogDigest);
  const headless = api.registry.providers.find((provider) => provider.providerId === "sda-headless-v3-proof-provider.v1");
  assert.equal(api.providerDigest(headless), headless.providerDigest);
  assert.equal(headless.admissionStatus, "PLANNING_ONLY");
  const source = fs.readFileSync(path.join(REPOSITORY_ROOT, "tools", "src", "ui-presentation", "application", "ui-embodiment-planner.ts"), "utf8");
  assert.doesNotMatch(source, /\b(?:react|wpf|xaml|css|html|javafx|swiftui|compose|appkit|winui|avalonia|qt|fyne)\b/iu);
});

test("v3 mechanics derive one exact deterministic capability vector", async () => {
  const api = await subject();
  const first = api.resolveUiEmbodimentRequirements(api.ir);
  assert.deepEqual(api.resolveUiEmbodimentRequirements(structuredClone(api.ir)), first);
  assert.equal(api.capabilityVectorDigest(first), first.canonicalDigest);
  assert.equal(api.requirementsAdmission.validate(first, "ui-capability-vector.v1.schema.json").valid, true);
  assert.deepEqual(first.requirements.map((item) => item.capabilityId), [
    "accessibility.live-feedback.v1",
    "accessibility.name.v1",
    "accessibility.operable-action.v1",
    "adaptation.grouping.v1",
    "adaptation.order.v1",
    "composition.flow.v1",
    "content.semantic-element.v1",
    "interaction.activate.v1"
  ]);
  assert.deepEqual(first, json(path.join(REQUIREMENTS_ROOT, "fixtures", "minimal.ui-capability-vector.v1.json")));
});

test("canonical inputs select one provider and produce one immutable digest-pinned plan", async () => {
  const api = await subject();
  const vector = api.resolveUiEmbodimentRequirements(api.ir);
  const resolution = api.resolveUiEmbodimentProvider(vector, api.profile, api.registry);
  assert.equal(resolution.disposition, "SELECTED");
  assert.equal(resolution.selectedProviderId, "sda-headless-v3-proof-provider.v1");
  assert.equal(api.providerAdmission.validate(resolution, "provider-resolution.v1.schema.json").valid, true);
  const first = api.planUiEmbodiment(api.presentation, api.ir, vector, api.profile, api.registry);
  const second = api.planUiEmbodiment(api.presentation, api.ir, vector, api.profile, api.registry);
  assert.deepEqual(second, first);
  assert.equal(api.embodimentPlanDigest(first.plan), first.plan.canonicalDigest);
  assert.equal(api.planAdmission.validate(first.plan, "ui-embodiment-plan.v1.schema.json").valid, true);
  assert.equal(first.plan.bindings.length, vector.requirements.length);
  assert.deepEqual(first.plan.observationRequirements, ["ACCESSIBILITY", "ADAPTATION", "OBSERVATION"]);
  assert.deepEqual(first.plan.accessibilityObligationRefs, [
    "accessibility.resolve-operable",
    "accessibility.result-name",
    "accessibility.status-live"
  ]);
  assert.deepEqual(resolution, json(path.join(PROVIDER_ROOT, "fixtures", "minimal.provider-resolution.v1.json")));
  assert.deepEqual(first.plan, json(path.join(PLAN_ROOT, "fixtures", "minimal.ui-embodiment-plan.v1.json")));

  const stalePresentation = structuredClone(api.presentation);
  stalePresentation.elements[0].semanticRole = "SUPPORTING";
  assert.throws(
    () => api.planUiEmbodiment(stalePresentation, api.ir, vector, api.profile, api.registry),
    /SEMANTIC_PRESENTATION_PLAN_INPUT_DIVERGENCE/u
  );

  const incompleteVector = structuredClone(vector);
  incompleteVector.requirements = incompleteVector.requirements.slice(1);
  incompleteVector.canonicalDigest = api.capabilityVectorDigest(incompleteVector);
  assert.throws(
    () => api.planUiEmbodiment(api.presentation, api.ir, incompleteVector, api.profile, api.registry),
    /CAPABILITY_VECTOR_PLAN_INPUT_DIVERGENCE/u
  );
});

test("unsupported, ambiguous, requested-provider, and catalog mutations reject deterministically", async () => {
  const api = await subject();
  const vector = api.resolveUiEmbodimentRequirements(api.ir);
  const headlessIndex = api.registry.providers.findIndex((provider) => provider.providerId === "sda-headless-v3-proof-provider.v1");

  const unsupported = structuredClone(api.registry);
  unsupported.providers[headlessIndex].features = unsupported.providers[headlessIndex].features.filter((item) => item.capabilityId !== "interaction.activate.v1");
  unsupported.providers[headlessIndex].providerDigest = api.providerDigest(unsupported.providers[headlessIndex]);
  unsupported.catalogDigest = api.providerCatalogDigest(unsupported);
  assert.deepEqual(api.resolveUiEmbodimentProvider(vector, api.profile, unsupported).findings, [{
    code: "NO_COMPATIBLE_PROVIDER",
    subjectRef: "target.headless-proof"
  }]);

  const ambiguous = structuredClone(api.registry);
  const second = structuredClone(ambiguous.providers[headlessIndex]);
  second.providerId = "sda-headless-v3-proof-provider.alternate";
  second.providerDigest = api.providerDigest(second);
  ambiguous.providers.push(second);
  ambiguous.catalogDigest = api.providerCatalogDigest(ambiguous);
  assert.deepEqual(api.resolveUiEmbodimentProvider(vector, api.profile, ambiguous).findings, [{
    code: "AMBIGUOUS_PROVIDER",
    subjectRef: "target.headless-proof"
  }]);

  const requested = structuredClone(api.profile);
  requested.requestedProviderId = "provider.missing";
  requested.canonicalDigest = api.targetProfileDigest(requested);
  assert.deepEqual(api.resolveUiEmbodimentProvider(vector, requested, api.registry).findings, [{
    code: "REQUESTED_PROVIDER_NOT_FOUND",
    subjectRef: "provider.missing"
  }]);

  const staleCatalog = structuredClone(api.registry);
  staleCatalog.providers[headlessIndex].priority += 1;
  const stale = api.resolveUiEmbodimentProvider(vector, api.profile, staleCatalog);
  assert.deepEqual(stale.findings.map((item) => item.code), [
    "PROVIDER_CATALOG_DIGEST_MISMATCH",
    "PROVIDER_DIGEST_MISMATCH"
  ]);
  assert.equal(api.providerAdmission.validate(stale, "provider-resolution.v1.schema.json").valid, true);

  const staleIr = structuredClone(api.ir);
  staleIr.nodes[0].configuration.axis = "INLINE";
  assert.throws(() => api.resolveUiEmbodimentRequirements(staleIr), /PRESENTATION_IR_DIGEST_MISMATCH/u);
});
