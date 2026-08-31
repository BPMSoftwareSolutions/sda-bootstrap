"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const test = require("node:test");
const assert = require("node:assert/strict");
const { AjvSchemaAdmission } = require("../../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");
const { evaluateCapabilityAuthorityV2 } = require("../../capabilities/evaluates-capability-authority-v2");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel", "schemas"));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function valueAt(source, dottedPath) {
  return dottedPath.split(".").filter(Boolean).reduce((value, segment) => value?.[segment], source);
}

for (const capabilityId of [
  "workspace-governance",
  "kernel-implementation-admission",
  "conformance-evidence-publication",
  "structural-model-projection",
  "execution-vector-projection",
  "projected-implementation-promotion",
  "consumer-capability-compilation",
  "consumer-assurance",
  "realization-planning",
  "api-interface-projection",
  "tooling-migration-conveyor"
]) {
  test(`${capabilityId} authority is schema-valid and completely bound`, async () => {
    const root = path.join(REPO_ROOT, "capabilities", "sda-tooling", capabilityId);
    const capability = readJson(path.join(root, "capability.json"));
    const providers = readJson(path.join(root, "provider-bindings.json"));
    const observations = readJson(path.join(root, "observation-bindings.json"));
    const schemaResult = admission.validate(capability, "capability.v2.schema.json");
    assert.equal(schemaResult.valid, true, JSON.stringify(schemaResult.errors, null, 2));
    assert.deepEqual(evaluateCapabilityAuthorityV2(capability, providers, observations), {
      disposition: "SATISFIED",
      issues: []
    });
    for (const binding of providers.bindings) {
      const implementationPath = path.resolve(REPO_ROOT, binding.implementationRef);
      assert.ok(fs.existsSync(implementationPath), binding.implementationRef);
      if (binding.protocol === "projected-consumer-runtime-v2") {
        assert.ok(implementationPath.startsWith(`${REPO_ROOT}${path.sep}`),
          `projected provider escapes the repository: ${binding.implementationRef}`);
        const providerModule = await import(`${pathToFileURL(implementationPath).href}?digest=${crypto
          .createHash("sha256").update(fs.readFileSync(implementationPath)).digest("hex")}`);
        assert.equal(typeof providerModule.executeCapability, "function",
          `${binding.implementationRef} does not export executeCapability`);
        const projectedRoot = path.resolve(path.dirname(implementationPath), "..");
        const manifest = readJson(path.join(projectedRoot, "projection-manifest.json"));
        const manifestEntry = manifest.files.find((candidate) => candidate.path === "node/capability-runtime.generated.mjs");
        assert.equal(manifestEntry?.executableOrigin, "PROJECTED");
        assert.equal(manifestEntry?.sha256,
          crypto.createHash("sha256").update(fs.readFileSync(implementationPath)).digest("hex"));
        const fixtures = readJson(path.join(projectedRoot, "fixtures", "fixtures.json")).fixtures;
        for (const fixture of fixtures) {
          const result = await providerModule.executeCapability(structuredClone(fixture.input), {
            portOutcomes: fixture.portOutcomes
          });
          assert.equal(result.disposition, fixture.expected.disposition, fixture.fixtureId);
          assert.deepEqual(result.executions.map((execution) => execution.scenarioId),
            fixture.expected.scenarioSequence, fixture.fixtureId);
          for (const expectation of fixture.expected.outcomeAssertions ?? []) {
            const actual = valueAt(result.outcome, expectation.path);
            if (expectation.operator === "equals") assert.deepEqual(actual, expectation.value, fixture.fixtureId);
            else if (expectation.operator === "contains") assert.ok(actual.includes(expectation.value), fixture.fixtureId);
            else if (expectation.operator === "not-contains") assert.ok(!actual.includes(expectation.value), fixture.fixtureId);
            else assert.fail(`Unsupported projected provider fixture operator '${expectation.operator}'.`);
          }
        }
      }
    }
    for (const binding of observations.bindings) {
      assert.ok(fs.existsSync(path.join(REPO_ROOT, binding.configurationRef)), binding.configurationRef);
    }
    if (["workspace-governance", "kernel-implementation-admission", "conformance-evidence-publication", "consumer-capability-compilation", "consumer-assurance", "realization-planning", "api-interface-projection", "tooling-migration-conveyor"].includes(capabilityId)) {
      const contractsDirectory = path.join(root, "contracts");
      const contractSchemas = fs.readdirSync(contractsDirectory)
        .filter((file) => file.endsWith(".schema.json"))
        .map((file) => readJson(path.join(contractsDirectory, file)));
      const contractIds = capability.scenarios.flatMap((scenario) => [
        scenario.input.contract.contractId,
        scenario.outcome.evidence.contract.contractId
      ]);
      for (const contractId of contractIds) {
        const schema = contractSchemas.find((candidate) => candidate.$id.endsWith(`/${contractId}.schema.json`));
        assert.ok(schema, `${capabilityId} has no contract schema for ${contractId}`);
        assert.equal(schema.additionalProperties, false, `${contractId} must close its top-level contract shape`);
        assert.ok(Array.isArray(schema.required) && schema.required.length > 0,
          `${contractId} must declare required evidence or input fields`);
      }
    }
  });
}
