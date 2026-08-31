import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import bind, { platformMechanics } from "./admitted-consumer-platform.mjs";

const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const digest = (value) => sha(platformMechanics.canonicalize(value));

function write(directory, name, value) {
  const encoded = JSON.stringify(value);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, name), encoded, "utf8");
  return encoded;
}

function application(directory, name, options) {
  const bindingId = `port:${options.portId}`;
  const authorityDigest = digest({ capabilityId: options.capabilityId });
  const plan = {
    executionEmbodimentPlanType: "consumer-execution-embodiment-plan.v1",
    target: "node",
    capabilityId: options.capabilityId,
    source: {
      queryType: "projected-consumer-conformance-query.v1",
      queryId: `${name}-query`,
      queryDigest: digest({ queryId: `${name}-query` }),
      capabilityAuthorityDigest: authorityDigest,
      mechanicResolutionDigest: digest({ providerCapabilityId: options.providerCapabilityId })
    },
    rootNodeId: options.scenarioId,
    nodes: [{
      nodeId: options.scenarioId,
      scenario: {
        scenarioId: options.scenarioId,
        input: { inputId: "input", contract: { contractId: "input.v1" } },
        event: { eventId: "event", executionAuthorityId: "event.v1" },
        outcome: { outcomeId: "outcome", contract: { contractId: "outcome.v1" }, terminal: true }
      },
      operations: [{ operationId: `${options.scenarioId}.operation.1`, mechanicBindingId: bindingId }],
      transition: null
    }],
    mechanicBindings: [{
      bindingId: "contract-admission",
      mechanicType: "contract-admission",
      providerCapabilityId: "sda-fixture-contract-validator.v1",
      provider: "node-native-test-provider",
      implementationRef: "languages/typescript/runtimes/node/node-mechanic-registry-loader.mjs",
      configuration: {}
    }, {
      bindingId,
      mechanicType: "event-port",
      providerCapabilityId: options.providerCapabilityId,
      provider: "node-native-test-provider",
      implementationRef: "languages/typescript/runtimes/node/node-mechanic-registry-loader.mjs",
      configuration: options.configuration
    }],
    conformance: {
      queryId: `${name}-query`,
      platformMechanics: { disposition: "RESOLVED", resolutions: [] },
      executableOrigin: { disposition: "PROJECTED_ONLY" },
      closures: [{ closureId: "compiled-test-closure", evaluation: "compiled", disposition: "PASS", findings: [] }]
    },
    requiredProviderCapabilityIds: ["sda-fixture-contract-validator.v1", options.providerCapabilityId].sort()
  };
  const planName = `${name}-plan.json`;
  const encodedPlan = write(directory, planName, plan);
  write(directory, `${name}-fixtures.json`, {
    fixtureType: "consumer-capability-fixtures.v1",
    fixtures: options.fixtures ?? []
  });
  write(directory, `${name}-sterility.json`, { disposition: "PURE_PROJECTION_CONFORMS" });
  const binding = {
    bindingType: "projected-consumer-application-binding.v2",
    executionPlan: planName,
    executionPlanDigest: sha(encodedPlan),
    fixtures: `${name}-fixtures.json`,
    mechanicalSterility: `${name}-sterility.json`
  };
  write(directory, `${name}-binding.json`, binding);
  return { binding, plan };
}

function fixture(fixtureId, input) {
  return {
    fixtureId,
    input,
    expected: {
      disposition: "terminated",
      terminalScenarioId: "return-input",
      scenarioSequence: ["return-input"],
      outcomeAssertions: [{ conditionId: "input-preserved", path: "proof", operator: "equals", value: input.proof }]
    }
  };
}

function arrange(configuration = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sda-external-application-root-"));
  const host = fs.mkdtempSync(path.join(os.tmpdir(), "sda-external-application-host-"));
  const child = application(root, "child", {
    capabilityId: "external-application-child",
    scenarioId: "return-input",
    portId: "return-input",
    providerCapabilityId: "sda-authority-transformation-port.v1",
    configuration: { expression: { op: "path", from: "input", path: "" } },
    fixtures: [fixture("alpha", { proof: "alpha" }), fixture("multibyte", { proof: "é" })]
  });
  application(host, "parent", {
    capabilityId: "external-application-parent",
    scenarioId: "execute-external-application",
    portId: "execute-external-application",
    providerCapabilityId: "sda-governed-external-root-projected-application-execution-port.v1",
    configuration: {
      rootPath: "rootRef",
      operationsPath: "operations",
      resultPath: "execution",
      lineageMode: "retain-nested-execution",
      ...configuration
    }
  });
  const execute = bind(pathToFileURL(path.join(host, "host.mjs")).href, "parent-binding.json");
  return { root, host, child, execute };
}

test("preserves the carrier without resolving an external root when its invocation condition is false", async (t) => {
  const arranged = arrange({
    invocationCondition: { path: "control.active", equals: true, whenFalse: "preserve-carrier" }
  });
  t.after(() => { fs.rmSync(arranged.root, { recursive: true, force: true }); fs.rmSync(arranged.host, { recursive: true, force: true }); });
  const carrier = {
    control: { active: false },
    rootRef: "file:///authority-that-must-not-be-resolved",
    operations: []
  };
  const result = await arranged.execute(carrier);
  assert.equal(result.disposition, "terminated");
  assert.deepEqual(result.outcome, carrier);
});

test("invokes one digest-bound projected application from a caller-authorized external root", async (t) => {
  const arranged = arrange();
  t.after(() => { fs.rmSync(arranged.root, { recursive: true, force: true }); fs.rmSync(arranged.host, { recursive: true, force: true }); });
  const result = await arranged.execute({
    rootRef: pathToFileURL(arranged.root).href,
    operations: [{
      operationId: "invoke-child",
      kind: "invoke",
      bindingRef: "child-binding.json",
      bindingDigest: digest(arranged.child.binding),
      capabilityAuthorityDigest: arranged.child.plan.source.capabilityAuthorityDigest,
      request: { proof: "invoked" }
    }]
  });
  assert.equal(result.disposition, "terminated");
  assert.deepEqual(result.outcome.execution.observations[0].outcome, { proof: "invoked" });
  assert.equal(result.outcome.execution.observations[0].disposition, "terminated");
});

test("proves the declared fixture suite without a generated test module", async (t) => {
  const arranged = arrange();
  t.after(() => { fs.rmSync(arranged.root, { recursive: true, force: true }); fs.rmSync(arranged.host, { recursive: true, force: true }); });
  const result = await arranged.execute({
    rootRef: pathToFileURL(arranged.root).href,
    operations: [{
      operationId: "prove-child",
      kind: "prove-fixtures",
      bindingRef: "child-binding.json",
      bindingDigest: digest(arranged.child.binding),
      capabilityAuthorityDigest: arranged.child.plan.source.capabilityAuthorityDigest
    }]
  });
  const observation = result.outcome.execution.observations[0];
  assert.equal(observation.disposition, "PROVED", JSON.stringify(observation));
  assert.equal(observation.tests, 3);
  assert.equal(observation.passed, 3);
  assert.equal(observation.failed, 0);
  assert.deepEqual(observation.fixtureObservations.map((item) => item.fixtureId), ["alpha", "multibyte"]);
});

test("rejects traversal and digest divergence before execution", async (t) => {
  const arranged = arrange();
  t.after(() => { fs.rmSync(arranged.root, { recursive: true, force: true }); fs.rmSync(arranged.host, { recursive: true, force: true }); });
  for (const operation of [
    {
      operationId: "traversal",
      kind: "invoke",
      bindingRef: "../child-binding.json",
      bindingDigest: digest(arranged.child.binding),
      capabilityAuthorityDigest: arranged.child.plan.source.capabilityAuthorityDigest,
      request: { proof: "not-run" }
    },
    {
      operationId: "wrong-digest",
      kind: "invoke",
      bindingRef: "child-binding.json",
      bindingDigest: `sha256:${"0".repeat(64)}`,
      capabilityAuthorityDigest: arranged.child.plan.source.capabilityAuthorityDigest,
      request: { proof: "not-run" }
    }
  ]) {
    const result = await arranged.execute({ rootRef: pathToFileURL(arranged.root).href, operations: [operation] });
    assert.equal(result.disposition, "failed");
    assert.match(result.errorCode, /EXTERNAL_APPLICATION_(BINDING_REFERENCE_REJECTED|EXECUTION_LINEAGE_MISMATCH)/);
  }
});
