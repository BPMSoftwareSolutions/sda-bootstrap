"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const crypto = require("node:crypto");
const test = require("node:test");
const assert = require("node:assert/strict");
const REPO_ROOT = path.resolve(__dirname, "../../..");
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
const { NodePlatformCapabilityRepository } = require("../../../artifacts/tools/dist/adapters/consumer-projection/node-platform-capability-repository.js");
const { resolvePlatformMechanics } = require("../../../artifacts/tools/dist/consumer-projection/authority/platform-responsibility-resolver.js");
const { MechanicConformanceObserver, consumerPlatformInputDigest, consumerProofIsCurrent } = require("../../../artifacts/tools/dist/interfaces/consumer-projection/assure.js");
const digestModule = require("../../../artifacts/tools/dist/adapters/conformance/admission-input-digest.cjs");
const { computeAdmissionInputDigest, admissionArtifactIsCurrent } = digestModule;
const CATALOG_PATH = path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "sda-platform-capabilities.semantic-authority.json");
const PARITY_PATH = path.join(REPO_ROOT, "kernel", "semantic-authority", "consumer", "sda-platform-mechanic-parity.semantic-authority.json");
const ACTIVE_LANGUAGES = ["cpp", "csharp", "go", "java", "node", "python"];

function read(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function bindings() {
  return fs.readdirSync(path.join(REPO_ROOT, "languages"), { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const directory = path.join(REPO_ROOT, "languages", entry.name, "binding");
      return fs.existsSync(directory)
        ? fs.readdirSync(directory).filter((file) => file.endsWith(".binding.json")).map((file) => path.join(directory, file))
        : [];
    })
    .filter(fs.existsSync).map(read).sort((a, b) => a.language.localeCompare(b.language));
}

test("every ADMITTED consumer platform capability resolves to implementation and proof", () => {
  const catalog = read(CATALOG_PATH);
  const validation = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"))
    .validate(catalog, "sda-platform-capability-catalog.schema.json");
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  assert.ok(catalog.capabilities.length > 0);
  for (const capability of catalog.capabilities) {
    assert.equal(capability.status, "ADMITTED");
    assert.ok(fs.existsSync(path.join(REPO_ROOT, capability.implementationRef)), capability.implementationRef);
    assert.ok(fs.existsSync(path.join(REPO_ROOT, capability.conformanceRef)), capability.conformanceRef);
    assert.ok(!capability.implementationRef.startsWith("examples/"));
  }
});

test("platform capability catalog admits registered target identities without a closed language enum", () => {
  const catalog = read(CATALOG_PATH);
  const sample = catalog.capabilities[0];
  const candidate = { ...catalog, capabilities: [{ ...sample, capabilityId: "future-target-capability.v1", projectionTarget: "future-target" }] };
  const validation = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"))
    .validate(candidate, "sda-platform-capability-catalog.schema.json");
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
});

test("projected capability invocation v2 has an explicit admitted configuration contract", () => {
  const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"));
  const authority = {
    interfaceAuthorityType: "consumer-interface-authority.v1",
    contractValidatorCapabilityId: "sda-schema-contract-admission.v1",
    interfaces: [{ interfaceId: "composition-cli", kind: "cli", rootScenarioId: "compose", platformCapabilityId: "sda-json-cli.v1" }],
    portBindings: [{
      portId: "invoke-child-and-bind-outcome",
      platformCapabilityId: "sda-projected-capability-invocation-port.v2",
      configuration: {
        bindingRef: "child/projected/application-binding.json",
        bindingDigest: `sha256:${"1".repeat(64)}`,
        capabilityAuthorityDigest: `sha256:${"2".repeat(64)}`,
        requestPath: "childRequest",
        resultPath: "childOutcome",
        lineageMode: "retain-nested-execution"
      }
    }],
    projectionBindings: []
  };
  const valid = admission.validate(authority, "consumer-interface-authority.schema.json");
  assert.equal(valid.valid, true, JSON.stringify(valid.errors, null, 2));
  const invalid = admission.validate({
    ...authority,
    portBindings: [{ ...authority.portBindings[0], configuration: { ...authority.portBindings[0].configuration, bindingDigest: undefined } }]
  }, "consumer-interface-authority.schema.json");
  assert.equal(invalid.valid, false);

  const capability = read(CATALOG_PATH).capabilities.find((item) =>
    item.capabilityId === "sda-projected-capability-invocation-port.v2" && item.projectionTarget === "node");
  assert.ok(capability);
  assert.ok(capability.providesMechanics.includes("parent-carrier-preservation"));
  assert.ok(capability.providesMechanics.includes("nested-execution-lineage"));
  assert.ok(capability.providesMechanics.includes("pinned-capability-binding"));
});

test("C# physical mechanics are queryable as AVAILABLE platform capabilities", () => {
  const requested = [
    ["json-reading", "representation", "sda-csharp-json-representation.v1"],
    ["json-canonicalization", "representation", "sda-csharp-json-representation.v1"],
    ["json-schema-validation", "contract-validator", "sda-csharp-json-schema-contract-validator.v1"],
    ["authority-resolution", "authority-resolver", "sda-csharp-in-memory-authority-resolver.v1"],
    ["semantic-execution", "semantic-executor", "sda-csharp-in-memory-semantic-executor.v1"],
    ["telemetry-observation", "execution-observer", "sda-csharp-in-memory-execution-observer.v1"]
  ];
  const result = resolvePlatformMechanics({
    requirements: requested.map(([mechanicId, capabilityKind, requestedCapabilityId]) => ({ mechanicId, capabilityKind, requiredBy: "csharp-consumer-platform", requestedCapabilityId })),
    projectionTarget: "csharp", platformCapabilityCatalog: read(CATALOG_PATH), repository: new NodePlatformCapabilityRepository(REPO_ROOT)
  });
  assert.equal(result.disposition, "RESOLVED");
  assert.ok(result.resolutions.every((resolution) => resolution.status === "AVAILABLE"));
});

test("every active language has the canonical admitted platform mechanic floor", () => {
  const catalog = read(CATALOG_PATH);
  const parity = read(PARITY_PATH);
  const validation = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas")).validate(parity, "sda-platform-mechanic-parity.schema.json");
  assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
  const active = bindings().filter((binding) => parity.appliesToBindingStatuses.includes(binding.status)).map((binding) => binding.language);
  assert.deepEqual(active, ACTIVE_LANGUAGES);
  for (const language of active) {
    const mechanics = new Set(catalog.capabilities.filter((capability) => capability.projectionTarget === language && capability.status === "ADMITTED").flatMap((capability) => capability.providesMechanics));
    assert.deepEqual(parity.requiredMechanics.filter((mechanic) => !mechanics.has(mechanic)), []);
  }
});

test("every registered argv consumer target has the canonical admitted platform mechanic floor", () => {
  const catalog = read(CATALOG_PATH);
  const parity = read(PARITY_PATH);
  const languagesRoot = path.join(REPO_ROOT, "languages");
  const registeredTargets = fs.readdirSync(languagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ target: entry.name, root: path.join(languagesRoot, entry.name) }))
    .filter(({ root }) => fs.existsSync(path.join(root, "projection", "language-target-registration.json")))
    .filter(({ root }) => {
      const registration = read(path.join(root, "projection", "language-target-registration.json"));
      const profile = read(path.join(root, registration.toolchainProfileRef));
      return profile.driver === "argv.v1" && Boolean(profile.operations.consumer);
    })
    .map(({ root }) => read(path.join(root, "projection", "language-target-registration.json")).targetId);
  assert.ok(registeredTargets.includes("cpp"));
  for (const target of registeredTargets) {
    const mechanics = new Set(catalog.capabilities
      .filter((capability) => capability.projectionTarget === target && capability.status === "ADMITTED")
      .flatMap((capability) => capability.providesMechanics));
    assert.deepEqual(parity.requiredMechanics.filter((mechanic) => !mechanics.has(mechanic)), [], target);
  }
});

test("language mechanic profile resolution separates kernel admission from consumer closure", () => {
  const catalog = read(CATALOG_PATH);
  const authority = read(PARITY_PATH);
  const currentProofDigests = Object.fromEntries(ACTIVE_LANGUAGES.map((language) => [language, consumerPlatformInputDigest(REPO_ROOT, language, catalog)]));
  const observations = Object.fromEntries(ACTIVE_LANGUAGES.map((language) => [language, { language, conforming: true, disposition: "SATISFIED", proofInputDigest: currentProofDigests[language] }]));
  const result = new MechanicConformanceObserver().observe({
    authority, catalog, bindings: bindings(), observations, currentProofDigests,
    kernelAdmissions: Object.fromEntries(ACTIVE_LANGUAGES.map((language) => [language, "ADMITTED"])),
    availableCapabilityIds: new Set(catalog.capabilities.map((capability) => capability.capabilityId))
  });
  assert.deepEqual(result.languages.map(({ language, required, resolved, disposition }) => ({ language, required, resolved, disposition })),
    bindings().map(({ language }) => ACTIVE_LANGUAGES.includes(language)
      ? { language, required: 13, resolved: 13, disposition: "COMPLETE" }
      : { language, required: 0, resolved: 0, disposition: "NOT_APPLICABLE" }));
});

test("consumer readiness rejects proof when inputs change", () => {
  const catalog = read(CATALOG_PATH);
  const language = "java";
  const observation = { conforming: true, proofInputDigest: consumerPlatformInputDigest(REPO_ROOT, language, catalog) };
  assert.equal(consumerProofIsCurrent(REPO_ROOT, language, observation, catalog), true);
  const mutated = { ...catalog, capabilities: catalog.capabilities.map((capability) => capability.projectionTarget === language ? { ...capability, provider: `${capability.provider}.changed` } : capability) };
  assert.equal(consumerProofIsCurrent(REPO_ROOT, language, observation, mutated), false);

  const binding = bindings().find((item) => item.language === language);
  const obligation = { language, binding };
  const artifact = { proofInputDigest: computeAdmissionInputDigest(REPO_ROOT, obligation) };
  assert.equal(admissionArtifactIsCurrent(REPO_ROOT, obligation, artifact), true);
});

test("an active language with one missing mandatory mechanic is INCOMPLETE", () => {
  const catalog = read(CATALOG_PATH);
  const authority = read(PARITY_PATH);
  const currentProofDigests = Object.fromEntries(ACTIVE_LANGUAGES.map((language) => [language, "current"]));
  const observations = Object.fromEntries(ACTIVE_LANGUAGES.map((language) => [language, { conforming: true, disposition: "SATISFIED", proofInputDigest: "current" }]));
  const available = new Set(catalog.capabilities.filter((capability) => capability.projectionTarget !== "csharp" || !capability.providesMechanics.includes("interface-delivery")).map((capability) => capability.capabilityId));
  const result = new MechanicConformanceObserver().observe({ authority, catalog, bindings: bindings(), observations, currentProofDigests, kernelAdmissions: {}, availableCapabilityIds: available });
  const csharp = result.languages.find((language) => language.language === "csharp");
  assert.equal(csharp.disposition, "INCOMPLETE");
  assert.ok(csharp.missing.includes("interface-delivery"));
});

test("Node mandatory consumer mechanics execute generic document, schema, projection, and delivery behavior", async () => {
  const { platformMechanics } = await import(pathToFileURL(path.join(REPO_ROOT, "languages", "typescript", "runtimes", "node", "admitted-consumer-platform.mjs")).href);
  assert.equal(platformMechanics.canonicalize({ z: 1, a: { y: 2 } }), '{"a":{"y":2},"z":1}');
  const value = { value: "accepted" };
  assert.equal(platformMechanics.admitSchema({ type: "object", required: ["value"], additionalProperties: false, properties: { value: { type: "string", minLength: 1 } } }, value), value);
  assert.deepEqual(platformMechanics.projectTransition({ output: { next: 1 } }, value), { next: 1 });
  assert.equal(await platformMechanics.deliverInterface('{"value":1}', (input) => ({ result: input.value + 1 })), '{"result":2}');
  const schema = { $id: "https://example.test/value.v1.schema.json", type: "object", required: ["value"], additionalProperties: false, properties: { value: { type: "string", minLength: 1 } } };
  const contractAdmission = platformMechanics.createContractAdmission({ contracts: { "value.v1": { schemaRef: "value.schema.json", schemaId: schema.$id, schemaDigest: crypto.createHash("sha256").update(JSON.stringify(schema)).digest("hex"), schema } } });
  assert.deepEqual(await contractAdmission({ contractId: "value.v1" }, { value: "accepted" }), { value: "accepted" });
});

test("a missing implementation reference makes a declared capability unavailable", () => {
  const catalog = { catalogType: "sda-platform-capability-catalog.v1", capabilities: [{ capabilityId: "unproven-json", kind: "representation", status: "ADMITTED", projectionTarget: "csharp", provider: "Missing.Provider", providesMechanics: ["json-reading"], implementationRef: "missing/implementation.cs", conformanceRef: "missing/conformance.cs" }] };
  const result = resolvePlatformMechanics({ requirements: [{ mechanicId: "json-reading", capabilityKind: "representation", requiredBy: "csharp", requestedCapabilityId: "unproven-json" }], projectionTarget: "csharp", platformCapabilityCatalog: catalog, repository: new NodePlatformCapabilityRepository(REPO_ROOT) });
  assert.equal(result.resolutions[0].reason, "IMPLEMENTATION_EVIDENCE_MISSING");
});
