import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import bind, { platformMechanics } from "./admitted-consumer-platform.mjs";

function digest(value) {
  return `sha256:${crypto.createHash("sha256").update(platformMechanics.canonicalize(value)).digest("hex")}`;
}

function encodedDigest(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function write(directory, name, value) {
  const encoded = JSON.stringify(value);
  fs.writeFileSync(path.join(directory, name), encoded, "utf8");
  return encoded;
}

function writePlanApplication(directory, name, options) {
  const scenarioId = options.scenarioId;
  const portBindingId = `port:${options.portId}`;
  const capabilityAuthorityDigest = options.capabilityAuthorityDigest ?? digest({ capabilityId: options.capabilityId });
  const plan = {
    executionEmbodimentPlanType: "consumer-execution-embodiment-plan.v1",
    target: "node",
    capabilityId: options.capabilityId,
    source: {
      queryType: "projected-consumer-conformance-query.v1",
      queryId: `${name}-query`,
      queryDigest: digest({ queryId: `${name}-query` }),
      capabilityAuthorityDigest,
      mechanicResolutionDigest: digest({ providerCapabilityId: options.providerCapabilityId })
    },
    rootNodeId: scenarioId,
    nodes: [{
      nodeId: scenarioId,
      scenario: {
        scenarioId,
        input: { inputId: `${scenarioId}-input`, contract: { contractId: options.inputContractId } },
        event: { eventId: `${scenarioId}-event`, executionAuthorityId: `${scenarioId}-authority.v1` },
        outcome: { outcomeId: `${scenarioId}-outcome`, contract: { contractId: options.outcomeContractId }, terminal: true }
      },
      operations: [{ operationId: `${scenarioId}.operation.1`, mechanicBindingId: portBindingId }],
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
      bindingId: portBindingId,
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
  write(directory, `${name}-fixtures.json`, { fixtureType: "consumer-capability-fixtures.v1", fixtures: [] });
  write(directory, `${name}-sterility.json`, { disposition: "PURE_PROJECTION_CONFORMS" });
  const binding = {
    bindingType: "projected-consumer-application-binding.v2",
    executionPlan: planName,
    executionPlanDigest: encodedDigest(encodedPlan),
    fixtures: `${name}-fixtures.json`,
    mechanicalSterility: `${name}-sterility.json`
  };
  write(directory, `${name}-binding.json`, binding);
  return { binding, plan };
}

function createComposedApplications(directory, digestOverrides = {}, resultMode, invocationCondition) {
  const child = writePlanApplication(directory, "child", {
    capabilityId: "market-intelligence-child",
    scenarioId: "return-request",
    portId: "return-request-value",
    inputContractId: "request.v1",
    outcomeContractId: "result.v1",
    providerCapabilityId: "sda-authority-transformation-port.v1",
    configuration: { expression: { op: "path", from: "input" } }
  });
  writePlanApplication(directory, "parent", {
    capabilityId: "parent-carrier-composition",
    scenarioId: "compose-market-intelligence",
    portId: "resolve-market-intelligence",
    inputContractId: "carrier.v1",
    outcomeContractId: "carrier.v1",
    providerCapabilityId: "sda-projected-capability-invocation-port.v2",
    configuration: {
      bindingRef: "child-binding.json",
      bindingDigest: digestOverrides.bindingDigest ?? digest(child.binding),
      capabilityAuthorityDigest: digestOverrides.capabilityAuthorityDigest ?? child.plan.source.capabilityAuthorityDigest,
      requestPath: "marketRequest",
      ...(invocationCondition ? { invocationCondition } : {}),
      ...(resultMode === "replace-carrier" ? { resultMode } : { resultPath: "marketIntelligence" }),
      lineageMode: "retain-nested-execution"
    }
  });
  return bind(pathToFileURL(path.join(directory, "host.mjs")).href, "parent-binding.json");
}

async function writeGraphBranchApplication(directory) {
  const { canonicalGraphDigest } = await import("./semantic-execution-graph/index.js");
  const authorityDigest = digest({ capabilityId: "graph-branch-port-proof" });
  const cell = (cellId, variants, configuration, terminal = false, inputContractId = "graph-route.v1") => ({
    cellId,
    semanticAddress: `graph-branch-port-proof/scenario/${cellId}`,
    altitude: "scenario",
    parentCellId: null,
    input: { portId: `${cellId}:input`, contractId: inputContractId },
    execution: {
      kind: "scenario",
      authorityId: `${cellId}.v1`,
      authorityDigest,
      protocolRef: "cell-execution-protocol.v1",
      providerSlotId: `slot:${cellId}`,
      configuration
    },
    outcome: {
      portId: `${cellId}:outcome`,
      contractId: terminal ? "graph-result.v1" : inputContractId,
      variants
    },
    sourcePointers: [`graph-branch-port-proof#/${cellId}`],
    sourceAuthorityDigests: [authorityDigest],
    ...(terminal ? { terminal: true } : {})
  });
  const binding = (portId, expression) => ({
    kind: "invoke-port",
    portId,
    binding: {
      portId,
      platformCapabilityId: "sda-authority-transformation-port.v1",
      configuration: { expression }
    }
  });
  const route = cell("route", ["ADMIT", "HOLD"], binding("resolve-route", { op: "path", from: "input", path: "" }), false, "graph-choice.v1");
  const admitted = cell("admitted", ["SUCCESS"], binding("admit-result", {
    op: "object",
    fields: {
      carrierType: { op: "literal", value: "graph-result.v1" },
      result: { op: "literal", value: "admitted" }
    }
  }), true);
  const held = cell("held", ["SUCCESS"], binding("hold-result", {
    op: "object",
    fields: {
      carrierType: { op: "literal", value: "graph-result.v1" },
      result: { op: "literal", value: "held" }
    }
  }), true);
  const edge = (edgeId, target, selectsVariant) => ({
    edgeId,
    kind: "selection",
    from: { cellId: route.cellId, portId: route.outcome.portId },
    to: { cellId: target.cellId, portId: target.input.portId },
    edgeContractId: "graph-route.v1",
    authorityDigest,
    sourcePointers: [`graph-branch-port-proof#/edges/${edgeId}`],
    groupId: "route-choice",
    bindingAuthorityId: "project-choice-to-route",
    selectsVariant
  });
  const admitEdge = edge("route-admit", admitted, "ADMIT");
  const holdEdge = edge("route-hold", held, "HOLD");
  const graph = {
    graphType: "sda-semantic-execution-graph.v1",
    graphId: "graph:graph-branch-port-proof",
    graphVersion: "1.0.0",
    rootCellId: route.cellId,
    authority: { capabilityId: "graph-branch-port-proof", authorityDigest, sourceRefs: ["graph-branch-port-proof"] },
    cells: [route, admitted, held],
    edges: [admitEdge, holdEdge],
    decompositions: [],
    edgeGroups: [{
      groupId: "route-choice",
      kind: "selection",
      edgeIds: [admitEdge.edgeId, holdEdge.edgeId],
      policy: "exactly-one",
      exhaustive: true,
      exclusive: true
    }],
    recurrenceAuthorities: [],
    requiredProviderSlots: [route, admitted, held].map((item) => ({
      slotId: item.execution.providerSlotId,
      cellId: item.cellId,
      mechanicId: "sda-authority-transformation-port.v1",
      profileConstraints: ["deterministic", "target-neutral"]
    }))
  };
  const graphDigest = canonicalGraphDigest(graph);
  const overlay = {
    overlayType: "execution-graph-realization-overlay.v1",
    overlayId: "overlay:graph-branch-port-proof:node",
    graphId: graph.graphId,
    canonicalGraphDigest: graphDigest,
    targetId: "node",
    providerBindings: [route, admitted, held].map((item) => ({
      slotId: item.execution.providerSlotId,
      cellId: item.cellId,
      mechanicId: "sda-authority-transformation-port.v1",
      providerProfileId: "node:sda-authority-transformation-port.v1",
      providerProfileDigest: digest({ profileId: "node:sda-authority-transformation-port.v1" }),
      implementationRef: "languages/typescript/runtimes/node/admitted-consumer-platform.mjs"
    })),
    physicalCells: [],
    physicalEdges: []
  };
  const schemaEntry = (schemaRef, schema) => ({
    schemaRef,
    schemaId: schema.$id,
    schemaDigest: crypto.createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
    schema
  });
  const routeSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.scenario-driven.dev/graph-route.v1.schema.json",
    type: "object",
    additionalProperties: false,
    required: ["carrierType", "route"],
    properties: {
      carrierType: { const: "graph-route.v1" },
      route: { enum: ["ADMIT", "HOLD"] }
    }
  };
  const choiceSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.scenario-driven.dev/graph-choice.v1.schema.json",
    type: "object",
    additionalProperties: false,
    required: ["carrierType", "route"],
    properties: {
      carrierType: { const: "graph-choice.v1" },
      route: { enum: ["ADMIT", "HOLD"] }
    }
  };
  const resultSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://schemas.scenario-driven.dev/graph-result.v1.schema.json",
    type: "object",
    additionalProperties: false,
    required: ["carrierType", "result"],
    properties: {
      carrierType: { const: "graph-result.v1" },
      result: { enum: ["admitted", "held"] }
    }
  };
  const plan = {
    executionEmbodimentPlanType: "consumer-execution-embodiment-plan.v3",
    target: "node",
    capabilityId: "graph-branch-port-proof",
    canonicalGraph: graph,
    canonicalGraphDigest: graphDigest,
    realizationOverlay: overlay,
    contractCatalog: {
      authorityType: "consumer-contract-authorities.v1",
      contracts: {
        "graph-choice.v1": schemaEntry("graph-choice.v1.schema.json", choiceSchema),
        "graph-route.v1": schemaEntry("graph-route.v1.schema.json", routeSchema),
        "graph-result.v1": schemaEntry("graph-result.v1.schema.json", resultSchema)
      }
    },
    bindingAuthorities: [{
      id: "project-choice-to-route",
      inputContract: { contractId: "graph-choice.v1" },
      outputContract: { contractId: "graph-route.v1" },
      kind: "binding",
      binding: {
        projectionId: "project-choice-to-route",
        platformCapabilityId: "sda-authority-state-projection.v1",
        configuration: {
          expression: {
            op: "object",
            fields: {
              carrierType: { op: "literal", value: "graph-route.v1" },
              route: { op: "path", from: "input", path: "route" }
            }
          }
        }
      }
    }],
    conformanceClosures: []
  };
  const encodedPlan = write(directory, "graph-branch-plan.json", plan);
  write(directory, "graph-branch-fixtures.json", { fixtureType: "consumer-capability-fixtures.v1", fixtures: [] });
  write(directory, "graph-branch-sterility.json", { disposition: "PURE_PROJECTION_CONFORMS" });
  write(directory, "graph-branch-binding.json", {
    bindingType: "projected-consumer-application-binding.v3",
    executionPlan: "graph-branch-plan.json",
    executionPlanDigest: encodedDigest(encodedPlan),
    fixtures: "graph-branch-fixtures.json",
    mechanicalSterility: "graph-branch-sterility.json"
  });
}

test("projected capability invocation executes a separately bound plan", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-capability-invocation-"));
  try {
    writePlanApplication(directory, "invoked", {
      capabilityId: "invoked-proof",
      scenarioId: "return-proof",
      portId: "proof-value",
      inputContractId: "proof.v1",
      outcomeContractId: "proof.v1",
      providerCapabilityId: "sda-declarative-value-port.v1",
      configuration: { outcome: { proof: "invoked" } }
    });
    const result = await platformMechanics.invokeProjectedCapability("invoked-binding.json", { request: "proof" }, {
      baseUrl: pathToFileURL(path.join(directory, "host.mjs")),
      rootExecutionId: "host.execution.invoked-proof"
    });
    assert.equal(result.disposition, "terminated");
    assert.deepEqual(result.outcome, { proof: "invoked" });
    assert.equal(result.executions[0].rootExecutionId, "host.execution.invoked-proof");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("plan v3 dispatches admitted transformation ports and executes exactly one declared branch", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-graph-port-branch-"));
  try {
    await writeGraphBranchApplication(directory);
    const execute = bind(pathToFileURL(path.join(directory, "host.mjs")).href, "graph-branch-binding.json");
    const admitted = await execute({ carrierType: "graph-choice.v1", route: "ADMIT" });
    assert.equal(admitted.disposition, "terminated");
    assert.deepEqual(admitted.outcome, { carrierType: "graph-result.v1", result: "admitted" });
    assert.deepEqual(admitted.executions.map((item) => item.scenarioId), ["route", "admitted"]);
    assert.deepEqual(admitted.graphExecution.edgeTestimony.map((item) => item.edgeId), ["route-admit"]);

    const held = await execute({ carrierType: "graph-choice.v1", route: "HOLD" });
    assert.equal(held.disposition, "terminated");
    assert.deepEqual(held.outcome, { carrierType: "graph-result.v1", result: "held" });
    assert.deepEqual(held.executions.map((item) => item.scenarioId), ["route", "held"]);
    assert.deepEqual(held.graphExecution.edgeTestimony.map((item) => item.edgeId), ["route-hold"]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("v2 can return the pinned child outcome as the parent scenario carrier", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-capability-replacement-"));
  try {
    const execute = createComposedApplications(directory, {}, "replace-carrier");
    const result = await execute({ marketRequest: { scope: "child-only" }, parentMetadata: { correlationId: "not-output" } });
    assert.equal(result.disposition, "terminated");
    assert.deepEqual(result.outcome, { scope: "child-only" });
    assert.equal(result.nestedExecutions.length, 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("v2 binds only the child outcome into a preserved parent carrier and retains nested testimony", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-capability-composition-"));
  try {
    const execute = createComposedApplications(directory);
    const input = {
      marketRequest: { scope: "child-only" },
      candidateRequest: { candidate: "parent-owned" },
      marketIntelligence: null,
      parentMetadata: { correlationId: "preserved" }
    };
    const result = await execute(input);
    assert.equal(result.disposition, "terminated");
    assert.deepEqual(result.outcome, { ...input, marketIntelligence: { scope: "child-only" } });
    assert.deepEqual(input.marketIntelligence, null);
    assert.equal(result.executions.length, 1);
    assert.equal(result.executions[0].scenarioId, "compose-market-intelligence");
    assert.equal(result.nestedExecutions.length, 1);
    const testimony = result.nestedExecutions[0];
    assert.equal(testimony.testimonyType, "nested-capability-execution-testimony.v1");
    assert.equal(testimony.capabilityId, "market-intelligence-child");
    assert.equal(testimony.disposition, "terminated");
    assert.equal(testimony.executions.length, 1);
    assert.equal(testimony.observations.length, 5);
    assert.match(testimony.bindingDigest, /^sha256:[a-f0-9]{64}$/);
    assert.match(testimony.capabilityAuthorityDigest, /^sha256:[a-f0-9]{64}$/);
    assert.match(testimony.nestedExecutionDigest, /^sha256:[a-f0-9]{64}$/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("v2 conditionally skips a child invocation and preserves the parent carrier", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-capability-conditional-skip-"));
  try {
    const condition = { path: "switchRequired", equals: true, whenFalse: "preserve-carrier" };
    const execute = createComposedApplications(directory, {}, undefined, condition);
    const input = { switchRequired: false, parentMetadata: { correlationId: "stable" } };
    const result = await execute(input);
    assert.equal(result.disposition, "terminated");
    assert.deepEqual(result.outcome, input);
    assert.equal(result.nestedExecutions, undefined);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

for (const [label, overrides, errorCode] of [
  ["binding", { bindingDigest: `sha256:${"0".repeat(64)}` }, "PROJECTED_CAPABILITY_BINDING_DIGEST_MISMATCH"],
  ["capability authority", { capabilityAuthorityDigest: `sha256:${"0".repeat(64)}` }, "PROJECTED_CAPABILITY_AUTHORITY_DIGEST_MISMATCH"]
]) {
  test(`v2 rejects a mismatched ${label} digest before child invocation`, async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sda-capability-composition-digest-"));
    try {
      const execute = createComposedApplications(directory, overrides);
      const result = await execute({ marketRequest: { scope: "child-only" }, parentMetadata: { preserved: true } });
      assert.equal(result.disposition, "failed");
      assert.match(result.errorCode, new RegExp(`^${errorCode}`));
      assert.equal(result.nestedExecutions, undefined);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}
