"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"));

test("every kernel schema compiles and all references resolve", () => {
  assert.ok(admission.listSchemaFiles().length > 0);
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
});

test("the canonical execution vector is schema-admitted", () => {
  const instance = JSON.parse(fs.readFileSync(path.join(
    REPO_ROOT,
    "kernel",
    "contracts",
    "execution",
    "scenario-kernel-execution-vector.json"
  ), "utf8"));
  const result = admission.validate(instance, "scenario-kernel-execution-vector.schema.json");
  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
});

test("every language binding is schema-admitted", () => {
  const languagesRoot = path.join(REPO_ROOT, "languages");
  const bindingPaths = fs.readdirSync(languagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(languagesRoot, entry.name, "binding", `scenario-kernel-${entry.name}.binding.json`))
    .filter((bindingPath) => fs.existsSync(bindingPath));
  assert.ok(bindingPaths.length > 0);
  for (const bindingPath of bindingPaths) {
    const binding = JSON.parse(fs.readFileSync(bindingPath, "utf8"));
    const result = admission.validate(binding, "language-binding.schema.json");
    assert.equal(result.valid, true, `${bindingPath}: ${JSON.stringify(result.errors)}`);
  }
});

test("every language target registration and toolchain profile is schema-admitted", () => {
  const languagesRoot = path.join(REPO_ROOT, "languages");
  const registrations = fs.readdirSync(languagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      target: entry.name,
      registrationPath: path.join(languagesRoot, entry.name, "projection", "language-target-registration.json")
    }))
    .filter(({ registrationPath }) => fs.existsSync(registrationPath));
  assert.ok(registrations.length > 0);
  const registeredTargetIds = new Set();
  for (const { target, registrationPath } of registrations) {
    const registration = JSON.parse(fs.readFileSync(registrationPath, "utf8"));
    const registrationResult = admission.validate(registration, "language-target-registration.schema.json");
    assert.equal(registrationResult.valid, true, `${registrationPath}: ${JSON.stringify(registrationResult.errors)}`);
    assert.ok(!registeredTargetIds.has(registration.targetId),
      `projection target '${registration.targetId}' is registered by more than one language ecosystem`);
    registeredTargetIds.add(registration.targetId);
    const toolchainPath = path.join(languagesRoot, target, registration.toolchainProfileRef);
    const toolchain = JSON.parse(fs.readFileSync(toolchainPath, "utf8"));
    const toolchainResult = admission.validate(toolchain, "target-toolchain-profile.schema.json");
    assert.equal(toolchainResult.valid, true, `${toolchainPath}: ${JSON.stringify(toolchainResult.errors)}`);
    for (const provider of Object.values(registration.providers).filter((candidate) => candidate.authorityRef)) {
      const authorityPath = path.join(languagesRoot, target, provider.authorityRef);
      const authority = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
      const schema = authority.authorityType === "authority-source-inspection-profile.v1"
        ? "authority-source-inspection-profile.schema.json" : null;
      assert.ok(schema, `${authorityPath}: unknown provider authority type '${authority.authorityType}'`);
      const authorityResult = admission.validate(authority, schema);
      assert.equal(authorityResult.valid, true, `${authorityPath}: ${JSON.stringify(authorityResult.errors)}`);
    }
  }
  assert.ok(registrations.some(({ target }) => target === "cpp"));
});

test("every declared native runtime boundary is schema-admitted and enforced by its argv profile", () => {
  const languagesRoot = path.join(REPO_ROOT, "languages");
  const boundaries = fs.readdirSync(languagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      target: entry.name,
      targetRoot: path.join(languagesRoot, entry.name),
      boundaryPath: path.join(languagesRoot, entry.name, "conformance", "native-runtime-boundary.json")
    }))
    .filter(({ boundaryPath }) => fs.existsSync(boundaryPath));
  assert.ok(boundaries.some(({ target }) => target === "cpp"));

  for (const { target, targetRoot, boundaryPath } of boundaries) {
    const boundary = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
    const admitted = admission.validate(boundary, "native-runtime-boundary.schema.json");
    assert.equal(admitted.valid, true, `${boundaryPath}: ${JSON.stringify(admitted.errors)}`);
    assert.equal(boundary.targetId, target);

    const registration = JSON.parse(fs.readFileSync(path.join(targetRoot, "projection", "language-target-registration.json"), "utf8"));
    const toolchain = JSON.parse(fs.readFileSync(path.join(targetRoot, registration.toolchainProfileRef), "utf8"));
    const runtimeCommands = ["execution", "behavior", "consumer", "ui"]
      .flatMap((operation) => toolchain.operations[operation]?.steps ?? [])
      .map((step) => step.command);
    assert.ok(runtimeCommands.length > 0);
    assert.ok(runtimeCommands.every((command) => boundary.permittedRuntimeCommands.includes(command)), `${target} runtime profile admits a foreign command: ${runtimeCommands.join(", ")}`);
    assert.deepEqual(boundary.foreignRuntimeDependencies, []);
    assert.deepEqual(boundary.foreignSemanticDelegations, []);
  }
});
