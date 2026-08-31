"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const Ajv2020 = require("ajv/dist/2020").default;
const { AjvSchemaAdmission } = require("../../artifacts/tools/dist/adapters/contracts/ajv-schema-admission.cjs");

const REPO_ROOT = path.resolve(__dirname, "../..");
const D = `sha256:${"a".repeat(64)}`;

async function api() {
  return import("@sda/semantic-execution-graph-resolver");
}

function cell(id, options = {}) {
  const slot = options.slot === false ? undefined : `slot:${id}`;
  return {
    cellId: id,
    semanticAddress: `fixture/${id}`,
    altitude: options.altitude ?? "mechanic",
    parentCellId: options.parentCellId ?? null,
    input: { portId: `${id}:input`, contractId: options.inputContract ?? "value.v1", ...(options.cardinality ? { cardinality: options.cardinality } : {}) },
    execution: {
      kind: options.kind ?? (options.altitude === "physical" ? "physical" : "mechanic"),
      authorityId: options.authorityId ?? `authority:${id}`,
      authorityDigest: D,
      protocolRef: "cell-execution-protocol.v1",
      ...(slot ? { providerSlotId: slot } : {}),
      ...(options.primitiveProfileId ? { primitiveProfileId: options.primitiveProfileId } : {})
    },
    outcome: { portId: `${id}:outcome`, contractId: options.outcomeContract ?? "value.v1", variants: options.variants ?? ["SUCCESS"] },
    sourcePointers: [`fixture.json#/${id}`],
    sourceAuthorityDigests: [D],
    ...(options.terminal ? { terminal: true } : {})
  };
}

function edge(id, kind, from, to, options = {}) {
  return {
    edgeId: id,
    kind,
    from: { cellId: from.cellId, portId: from.outcome.portId },
    to: { cellId: to.cellId, portId: kind === "return" ? to.outcome.portId : to.input.portId },
    edgeContractId: to.input.contractId,
    authorityDigest: D,
    sourcePointers: [`fixture.json#/edges/${id}`],
    ...options
  };
}

function graph(id, root, cells, edges, options = {}) {
  return {
    graphType: "sda-semantic-execution-graph.v1",
    graphId: `graph:${id}`,
    graphVersion: "1.0.0",
    rootCellId: root.cellId,
    authority: { capabilityId: id, authorityDigest: D, sourceRefs: ["fixture.json"] },
    cells,
    edges,
    decompositions: options.decompositions ?? [],
    edgeGroups: options.edgeGroups ?? [],
    recurrenceAuthorities: options.recurrenceAuthorities ?? [],
    requiredProviderSlots: cells.filter((item) => item.execution.providerSlotId).map((item) => ({
      slotId: item.execution.providerSlotId,
      cellId: item.cellId,
      mechanicId: item.cellId,
      profileConstraints: ["deterministic"]
    }))
  };
}

async function overlayFor(source, providersByCell = {}) {
  const { canonicalGraphDigest, sha256 } = await api();
  return {
    overlayType: "execution-graph-realization-overlay.v1",
    overlayId: `overlay:${source.graphId}:node`,
    graphId: source.graphId,
    canonicalGraphDigest: canonicalGraphDigest(source),
    targetId: "node",
    providerBindings: source.requiredProviderSlots.map((slot) => ({
      slotId: slot.slotId,
      cellId: slot.cellId,
      mechanicId: slot.mechanicId,
      providerProfileId: providersByCell[slot.cellId] ?? `provider:${slot.cellId}`,
      providerProfileDigest: sha256({ cellId: slot.cellId }),
      implementationRef: "fixture-provider"
    })),
    physicalCells: [],
    physicalEdges: []
  };
}

test("workstream A contracts are closed and admit the universal cell protocol", () => {
  const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel/schemas"));
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  const protocol = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel/contracts/execution/cell-execution-protocol.v1.json"), "utf8"));
  assert.equal(admission.validate(protocol, "cell-execution-protocol.schema.json").valid, true);
  assert.deepEqual(protocol.steps.map((step) => step.sequence), [0, 1, 2, 3, 4]);
  for (const authorityRef of ["semantic-value-mechanics.authority.v1.json", "platform-effect-mechanics.authority.v1.json"]) {
    const authority = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel/semantic-authority/consumer", authorityRef), "utf8"));
    const result = admission.validate(authority, "mechanic-authority.schema.json");
    assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
    assert.ok(authority.mechanics.every((item) => item.inputContractId && item.outcomeContractId && item.conformanceRefs.length > 0));
  }
  const languageConformance = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "conformance/execution-graph/language-graph-v1-conformance.json"), "utf8"));
  assert.equal(admission.validate(languageConformance, "language-execution-graph-conformance.schema.json").valid, true);
  assert.deepEqual(languageConformance.targets.filter((item) => item.status === "ADMITTED").map((item) => item.targetId).sort(), ["csharp", "go", "java", "node", "python"]);
  assert.deepEqual(languageConformance.targets.filter((item) => item.status === "HELD").map((item) => item.targetId), ["cpp"]);
});

test("workstream D resolves graph mechanics through admitted resolver boundaries", async () => {
  const authorityRoot = path.join(REPO_ROOT, "kernel/semantic-authority/consumer");
  const runtimeRoot = path.join(REPO_ROOT, "languages/typescript/runtimes/node");
  const pure = JSON.parse(fs.readFileSync(path.join(authorityRoot, "semantic-value-mechanics.authority.v1.json"), "utf8"));
  const effects = JSON.parse(fs.readFileSync(path.join(authorityRoot, "platform-effect-mechanics.authority.v1.json"), "utf8"));
  const registry = JSON.parse(fs.readFileSync(path.join(authorityRoot, "node-mechanic-registry.authority.v1.json"), "utf8"));

  assert.ok(pure.mechanics.every((mechanic) =>
    mechanic.authoringForm?.expressedAs === "semantic-transformation-expression.v1" &&
    mechanic.authoringForm.operation === mechanic.mechanicId));
  assert.ok(effects.mechanics.every((mechanic) => mechanic.nativeFloor === true));
  assert.equal(fs.existsSync(path.join(runtimeRoot, "node-native-mechanic-providers.mjs")), false);
  assert.equal(fs.existsSync(path.join(runtimeRoot, "node-graph-mechanic-providers.mjs")), false);
  assert.equal(fs.existsSync(path.join(runtimeRoot, "node-graph-physical-providers.mjs")), false);

  const pureProfile = registry.graphProviderProfiles.find((profile) => profile.effectClassification === "pure");
  const effectProfile = registry.graphProviderProfiles.find((profile) => profile.effectClassification === "effect");
  assert.equal(pureProfile.mechanicAuthorityDigest, pure.authorityDigest);
  assert.equal(effectProfile.mechanicAuthorityDigest, effects.authorityDigest);
  assert.equal(pureProfile.providerModule, "semantic-transformation-evaluator.mjs");
  assert.equal(effectProfile.providerModule, "semantic-execution-graph/scheduler.js");
  for (const profile of registry.graphProviderProfiles) {
    const modulePath = path.join(runtimeRoot, profile.providerModule);
    assert.equal(fs.existsSync(modulePath), true, modulePath);
    const loaded = await import(pathToFileURL(modulePath).href);
    assert.equal(typeof loaded[profile.providerExport], "function");
  }
});

test("execution-vector projection contracts no longer admit open object shells", () => {
  const contractsRoot = path.join(REPO_ROOT, "capabilities/sda-tooling/execution-vector-projection/contracts");
  const admission = new AjvSchemaAdmission(contractsRoot);
  assert.deepEqual(admission.unresolvedSchemaFiles(), []);
  for (const schemaFile of admission.listSchemaFiles()) {
    const schema = JSON.parse(fs.readFileSync(path.join(contractsRoot, schemaFile), "utf8"));
    assert.equal(schema.type === "object" && schema.properties === undefined && schema.required === undefined, false, `${schemaFile} remains an open shell`);
    if (schema.type === "object") assert.equal(schema.additionalProperties, false, schemaFile);
  }
});

test("plan v3 and its graph/overlay payload are schema-admitted as one catalog", () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "conformance/execution-graph/fixtures/cross-target-selection.plan.v3.json"), "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  for (const schemaFile of fs.readdirSync(path.join(REPO_ROOT, "kernel/schemas")).filter((file) => file.endsWith(".schema.json"))) {
    const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "kernel/schemas", schemaFile), "utf8"));
    ajv.addSchema(schema);
    const filenameId = `https://schemas.scenario-driven.dev/kernel/${schemaFile}`;
    if (schema.$id !== filenameId) ajv.addSchema({ ...schema, $id: filenameId });
  }
  const planSchema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "capabilities/sda-platform/consumer-execution-embodiment/contracts/consumer-execution-embodiment-plan.v3.schema.json"), "utf8"));
  const validate = ajv.compile(planSchema);
  assert.equal(validate(fixture.plan), true, JSON.stringify(validate.errors, null, 2));
});

test("Node reproduces the shared canonical cross-target path", async () => {
  const { GraphTokenScheduler } = await api();
  const fixture = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "conformance/execution-graph/fixtures/cross-target-selection.plan.v3.json"), "utf8"));
  const providers = {
    "portable:cell:choose": (input) => ({ outcomeValue: input, outcomeVariant: input.route }),
    "portable:cell:left": (input) => ({ outcomeValue: { selected: "LEFT", requestId: input.requestId } }),
    "portable:cell:right": (input) => ({ outcomeValue: { selected: "RIGHT", requestId: input.requestId } })
  };
  const result = await new GraphTokenScheduler(fixture.plan.canonicalGraph, fixture.plan.realizationOverlay, {
    providers,
    rootExecutionId: fixture.rootExecutionId
  }).execute(fixture.input);
  assert.equal(result.observedPathDigest, fixture.expected.observedPathDigest);
  assert.deepEqual(result.outcome, fixture.expected.outcome);
  const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel/schemas"));
  assert.equal(admission.validate(fixture.plan.canonicalGraph, "semantic-execution-graph.schema.json").valid, true);
  assert.equal(admission.validate(fixture.plan.realizationOverlay, "execution-graph-realization-overlay.schema.json").valid, true);
  for (const item of result.cellTestimony) assert.equal(admission.validate(item, "cell-execution-testimony.schema.json").valid, true);
  for (const item of result.edgeTestimony) assert.equal(admission.validate(item, "edge-execution-testimony.schema.json").valid, true);
});

test("canonical compiler deterministically replaces the generic linear topology", async () => {
  const { SemanticExecutionGraphCompiler, canonicalGraphDigest } = await api();
  const query = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "examples/generic-capability/projected/query/conformance-query.json"), "utf8"));
  const authority = query.authorityGraph;
  const sources = {
    capability: { capabilityId: query.capabilityId, rootScenarioId: authority.rootScenarioId },
    scenarios: authority.scenarios,
    transitions: authority.transitions,
    executionAuthorities: authority.executionAuthorities,
    interfaceAuthority: authority.interfaceAuthority
  };
  const first = new SemanticExecutionGraphCompiler().compile(sources);
  const second = new SemanticExecutionGraphCompiler().compile(sources);
  assert.deepEqual(first.graph, second.graph);
  assert.equal(canonicalGraphDigest(first.graph), canonicalGraphDigest(second.graph));
  assert.equal(first.graph.graphType, "sda-semantic-execution-graph.v1");
  assert.ok(first.graph.cells.every((item) => item.execution.protocolRef === "cell-execution-protocol.v1"));
  assert.ok(first.graph.edges.some((item) => item.kind === "return"));
});

test("nested invocation returns only after every reachable branch reaches a terminal scenario", async () => {
  const { SemanticExecutionGraphCompiler } = await api();
  const scenario = (scenarioId, inputContract, outcomeContract, terminal = false) => ({
    scenarioId,
    input: { inputId: `${scenarioId}-input`, contract: { contractId: inputContract } },
    event: { eventId: `${scenarioId}-event`, executionAuthorityId: `${scenarioId}.v1` },
    outcome: { outcomeId: `${scenarioId}-outcome`, contract: { contractId: outcomeContract }, terminal },
    gherkin: {
      given: { semanticRef: `${scenarioId}.given`, text: "input is admitted" },
      when: { semanticRef: `${scenarioId}.when`, text: "the event executes" },
      then: { semanticRef: `${scenarioId}.then`, text: "the outcome is established" }
    },
    name: scenarioId
  });
  const sources = {
    capability: { capabilityId: "nested-terminal-circuit", rootScenarioId: "root" },
    scenarios: [
      scenario("root", "intent.v1", "result.v1", true),
      scenario("boundary", "intent.v1", "result.v1"),
      scenario("close", "result.v1", "result.v1", true)
    ],
    transitions: [{
      transitionId: "boundary-to-close",
      from: { scenarioId: "boundary", outcomeId: "boundary-outcome", contractId: "result.v1" },
      to: { scenarioId: "close", inputId: "close-input", contractId: "result.v1" },
      semanticProgress: "the complete nested circuit closes"
    }],
    executionAuthorities: [
      { id: "root.v1", owningScenarioId: "root", operations: [
        { kind: "invoke-scenario", scenarioId: "boundary" },
        { kind: "invoke-port", portId: "root-close-port" }
      ] },
      { id: "boundary.v1", owningScenarioId: "boundary", operations: [{ kind: "invoke-port", portId: "boundary-port" }] },
      { id: "close.v1", owningScenarioId: "close", operations: [{ kind: "invoke-port", portId: "close-port" }] }
    ],
    interfaceAuthority: {
      interfaceAuthorityType: "consumer-interface-authority.v1",
      contractValidatorCapabilityId: "sda-fixture-contract-validator.v1",
      interfaces: [],
      portBindings: ["boundary-port", "close-port", "root-close-port"].map((portId) => ({
        portId,
        platformCapabilityId: "sda-declarative-value-port.v1",
        configuration: { outcome: { carrierType: "result.v1" } }
      })),
      projectionBindings: []
    }
  };
  const compiled = new SemanticExecutionGraphCompiler().compile(sources);
  const invocationCellId = "cell:mechanic:root.operation.1";
  const decomposition = compiled.graph.decompositions.find((item) => item.parentCellId === invocationCellId);
  assert.deepEqual(decomposition.entryCellIds, ["cell:scenario:boundary"]);
  assert.deepEqual(decomposition.exitCellIds, ["cell:scenario:close"]);
  assert.ok(compiled.graph.edges.some((edge) => edge.kind === "return" &&
    edge.from.cellId === "cell:scenario:close" && edge.to.cellId === invocationCellId));
  const invocationReturn = compiled.graph.edges.find((edge) => edge.kind === "return" &&
    edge.from.cellId === "cell:scenario:close" && edge.to.cellId === invocationCellId);
  assert.equal(invocationReturn.edgeContractId, "semantic-value.v1");
  assert.equal("bindingAuthorityId" in invocationReturn, false);
  assert.ok(!compiled.graph.edges.some((edge) => edge.kind === "return" &&
    edge.from.cellId === "cell:scenario:boundary" && edge.to.cellId === invocationCellId));
});

test("consumer embodiment compiler exposes plan v3 without a second topology builder", async () => {
  const module = await import(pathToFileURL(path.join(REPO_ROOT, "artifacts/tools/dist/consumer-projection/application/consumer-execution-embodiment-compiler.js")).href);
  const query = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "examples/generic-capability/projected/query/conformance-query.node.json"), "utf8"));
  const capability = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "examples/generic-capability/projected/capability.json"), "utf8"));
  const plan = new module.ConsumerExecutionEmbodimentCompiler().compileV3(query, "node", capability);
  assert.equal(plan.executionEmbodimentPlanType, "consumer-execution-embodiment-plan.v3");
  assert.equal(plan.canonicalGraph.graphType, "sda-semantic-execution-graph.v1");
  assert.equal("nodes" in plan, false);
  assert.equal(plan.realizationOverlay.providerBindings.length, plan.canonicalGraph.requiredProviderSlots.length);
});

test("selection executes one declared branch and records the selected edge", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator, verifyObservedTopology } = await api();
  const root = cell("cell:choose", { variants: ["LEFT", "RIGHT"] });
  const left = cell("cell:left", { terminal: true });
  const right = cell("cell:right", { terminal: true });
  const leftEdge = edge("edge:left", "selection", root, left, { selectsVariant: "LEFT", groupId: "group:choice" });
  const rightEdge = edge("edge:right", "selection", root, right, { selectsVariant: "RIGHT", groupId: "group:choice" });
  const source = graph("selection", root, [root, left, right], [leftEdge, rightEdge], {
    edgeGroups: [{ groupId: "group:choice", kind: "selection", edgeIds: [leftEdge.edgeId, rightEdge.edgeId], policy: "exactly-one", exhaustive: true, exclusive: true }]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const providers = {
    "provider:cell:choose": () => ({ outcomeValue: { chosen: "left" }, outcomeVariant: "LEFT" }),
    "provider:cell:left": (input) => ({ outcomeValue: { ...input, result: "left" } }),
    "provider:cell:right": () => ({ outcomeValue: { result: "right" } })
  };
  const result = await new GraphTokenScheduler(source, overlay, { providers }).execute({ request: true });
  assert.equal(result.outcome.result, "left");
  assert.deepEqual(result.cellTestimony.map((item) => item.cellId), ["cell:choose", "cell:left"]);
  assert.deepEqual(result.edgeTestimony.map((item) => item.edgeId), ["edge:left"]);
  assert.equal(verifyObservedTopology(source, result.cellTestimony, result.edgeTestimony).disposition, "CONFORMING");
});

test("a boolean-selection junction routes a truthy carrier independently of its domain disposition", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const predicate = cell("cell:boolean-object-predicate", {
    kind: "junction",
    authorityId: "junction:boolean-selection.v1",
    slot: false,
    variants: ["TRUE", "FALSE"]
  });
  const truthy = cell("cell:boolean-object-truthy", { terminal: true });
  const falsey = cell("cell:boolean-object-falsey", { terminal: true });
  const trueEdge = edge("edge:boolean-object:true", "selection", predicate, truthy, {
    selectsVariant: "TRUE", groupId: "group:boolean-object"
  });
  const falseEdge = edge("edge:boolean-object:false", "selection", predicate, falsey, {
    selectsVariant: "FALSE", groupId: "group:boolean-object"
  });
  const source = graph("boolean-object-selection", predicate, [predicate, truthy, falsey], [trueEdge, falseEdge], {
    edgeGroups: [{
      groupId: "group:boolean-object",
      kind: "selection",
      edgeIds: [trueEdge.edgeId, falseEdge.edgeId],
      policy: "exactly-one",
      exhaustive: true,
      exclusive: true,
      defaultEdgeId: falseEdge.edgeId
    }]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const input = { disposition: "HOLD", findings: [{ code: "missing-input" }] };
  const result = await new GraphTokenScheduler(source, overlay, {
    providers: {
      "provider:cell:boolean-object-truthy": (value) => ({ outcomeValue: { selected: "truthy", value } }),
      "provider:cell:boolean-object-falsey": (value) => ({ outcomeValue: { selected: "falsey", value } })
    }
  }).execute(input);
  assert.equal(result.outcome.selected, "truthy");
  assert.deepEqual(result.edgeTestimony.map((item) => item.edgeId), [trueEdge.edgeId]);
});

test("diagram/data projections and reverse lineage come only from graph authority", async () => {
  const { graphProjectionData, renderExecutionGraphMermaid, reverseExecutionLineage } = await api();
  const parent = cell("cell:scenario", { altitude: "scenario", kind: "scenario", slot: false, terminal: true });
  const provider = cell("cell:provider", { altitude: "provider", parentCellId: parent.cellId });
  const physical = cell("cell:physical-lineage", { altitude: "physical", kind: "physical", primitiveProfileId: "primitive:lineage", parentCellId: provider.cellId });
  const returned = edge("edge:lineage-return", "return", physical, parent);
  const source = graph("lineage", parent, [parent, provider, physical], [
    edge("edge:provider-to-physical", "sequence", provider, physical),
    returned
  ], {
    decompositions: [{ parentCellId: parent.cellId, entryCellIds: [provider.cellId], exitCellIds: [physical.cellId], returnBindingAuthorityId: "binding:lineage-return" }]
  });
  const mermaid = renderExecutionGraphMermaid(source);
  assert.match(mermaid, /flowchart TD/);
  assert.match(mermaid, /edge:provider-to-physical/);
  assert.deepEqual(graphProjectionData(source).routes.map((item) => item.edgeId), ["edge:lineage-return", "edge:provider-to-physical"]);
  assert.deepEqual(reverseExecutionLineage(source, physical.cellId), [physical.cellId, provider.cellId, parent.cellId]);
});

test("broadcast and all-required join wait for three named legs", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const root = cell("cell:broadcast");
  const a = cell("cell:a");
  const b = cell("cell:b");
  const c = cell("cell:c");
  const join = cell("cell:join", { terminal: true, cardinality: "named-product" });
  const broadcastEdges = [a, b, c].map((target) => edge(`edge:broadcast:${target.cellId}`, "broadcast", root, target, { groupId: "group:broadcast" }));
  const joinEdges = [[a, "a"], [b, "b"], [c, "c"]].map(([from, slot]) => edge(`edge:join:${slot}`, "join", from, join, { groupId: "group:join", joinSlotId: slot, bindingAuthorityId: `binding:join:${slot}` }));
  const source = graph("fanout-join", root, [root, a, b, c, join], [...broadcastEdges, ...joinEdges], {
    edgeGroups: [
      { groupId: "group:broadcast", kind: "broadcast", edgeIds: broadcastEdges.map((item) => item.edgeId), policy: "all" },
      { groupId: "group:join", kind: "join", edgeIds: joinEdges.map((item) => item.edgeId), policy: "all-required", joinCellId: join.cellId, requiredSlotIds: ["a", "b", "c"] }
    ]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const providers = Object.fromEntries(source.cells.map((item) => [`provider:${item.cellId}`, (input) => ({ outcomeValue: item.cellId === join.cellId ? input : item.cellId })]));
  const result = await new GraphTokenScheduler(source, overlay, {
    providers,
    projectBinding: async (bindingAuthorityId, value) => `${bindingAuthorityId}:${value}`
  }).execute("start");
  assert.deepEqual(result.outcome, {
    a: "binding:join:a:cell:a",
    b: "binding:join:b:cell:b",
    c: "binding:join:c:cell:c"
  });
  assert.equal(result.edgeTestimony.filter((item) => item.admissionDisposition === "buffered").length, 2);
});

test("first-admitted join continues once and cancels later legs", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const root = cell("cell:first-broadcast");
  const fast = cell("cell:fast");
  const slow = cell("cell:slow");
  const joined = cell("cell:first-joined", { terminal: true });
  const broadcastEdges = [fast, slow].map((target) => edge(`edge:first:${target.cellId}`, "broadcast", root, target, { groupId: "group:first-broadcast" }));
  const joinEdges = [[fast, "fast"], [slow, "slow"]].map(([from, slot]) => edge(`edge:first-join:${slot}`, "join", from, joined, { groupId: "group:first-join", joinSlotId: slot }));
  const source = graph("first-admitted", root, [root, fast, slow, joined], [...broadcastEdges, ...joinEdges], {
    edgeGroups: [
      { groupId: "group:first-broadcast", kind: "broadcast", edgeIds: broadcastEdges.map((item) => item.edgeId), policy: "all" },
      { groupId: "group:first-join", kind: "join", edgeIds: joinEdges.map((item) => item.edgeId), policy: "first-admitted", joinCellId: joined.cellId, requiredSlotIds: [] }
    ]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const providers = Object.fromEntries(source.cells.map((item) => [`provider:${item.cellId}`, (input) => ({ outcomeValue: item.cellId === joined.cellId ? input : item.cellId })]));
  const result = await new GraphTokenScheduler(source, overlay, { providers }).execute("start");
  assert.deepEqual(result.outcome, { fast: "cell:fast" });
  assert.equal(result.cellTestimony.filter((item) => item.cellId === joined.cellId).length, 1);
  assert.equal(result.edgeTestimony.find((item) => item.edgeId === "edge:first-join:slow").admissionDisposition, "cancelled");
});

test("nested decomposition returns through the declared parent outcome", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const parent = cell("cell:parent", { altitude: "scenario", kind: "scenario", slot: false, terminal: true });
  const child = cell("cell:child", { parentCellId: parent.cellId });
  const returned = edge("edge:return", "return", child, parent);
  const source = graph("nested", parent, [parent, child], [returned], {
    decompositions: [{ parentCellId: parent.cellId, entryCellIds: [child.cellId], exitCellIds: [child.cellId], returnBindingAuthorityId: "binding:return" }]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const result = await new GraphTokenScheduler(source, overlay, { providers: { "provider:cell:child": (input) => ({ outcomeValue: { ...input, nested: true } }) } }).execute({ value: 1 });
  assert.deepEqual(result.outcome, { value: 1, nested: true });
  assert.deepEqual(result.cellTestimony.map((item) => item.cellId), [child.cellId, parent.cellId]);
});

test("projected Node execution admits only the declared configless identity mechanic", async () => {
  const { canonicalGraphDigest } = await api();
  const { platformMechanics } = await import(pathToFileURL(path.join(
    REPO_ROOT,
    "languages/typescript/runtimes/node/admitted-consumer-platform.mjs"
  )).href);
  const execute = async (authorityId) => {
    const identity = cell("cell:configless-identity", {
      authorityId,
      terminal: true,
      variants: ["VALUE"]
    });
    const source = graph("configless-identity", identity, [identity], []);
    const overlay = await overlayFor(source);
    const valueSchema = { $id: "https://fixtures.scenario-driven.io/value.v1.schema.json" };
    const plan = {
      executionEmbodimentPlanType: "consumer-execution-embodiment-plan.v3",
      canonicalGraphDigest: canonicalGraphDigest(source),
      canonicalGraph: source,
      realizationOverlay: overlay,
      bindingAuthorities: [],
      contractCatalog: {
        authorityType: "consumer-contract-authorities.v1",
        contracts: {
          "value.v1": {
            schemaRef: "value.schema.json",
            schemaDigest: crypto.createHash("sha256").update(JSON.stringify(valueSchema)).digest("hex"),
            schema: valueSchema
          }
        }
      }
    };
    return platformMechanics.invokeScenario({
      bindingUrl: pathToFileURL(path.join(REPO_ROOT, "examples/generic-capability/application-binding.json")).href,
      plan
    }, { identity: "preserved" });
  };

  const result = await execute("mechanic:identity.v1");
  assert.equal(result.disposition, "terminated");
  assert.deepEqual(result.outcome, { identity: "preserved" });
  const undeclared = await execute("mechanic:undeclared-configless.v1");
  assert.equal(undeclared.disposition, "failed");
  assert.match(undeclared.outcome.message, /UNDECLARED_EXECUTION_MECHANIC/);
});

test("a decomposed transformation retains its entering carrier as lexical input", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const transformation = cell("cell:lexical-transformation", { altitude: "scenario", kind: "scenario", slot: false, terminal: true });
  const precedingLeaf = cell("cell:lexical-preceding-leaf", { parentCellId: transformation.cellId });
  const finalExpression = cell("cell:lexical-final-expression", { parentCellId: transformation.cellId });
  const sequence = edge("edge:lexical-sequence", "sequence", precedingLeaf, finalExpression);
  const returned = edge("edge:lexical-return", "return", finalExpression, transformation);
  const source = graph("decomposed-transformation-lexical-input", transformation, [transformation, precedingLeaf, finalExpression], [sequence, returned], {
    decompositions: [{
      parentCellId: transformation.cellId,
      entryCellIds: [precedingLeaf.cellId],
      exitCellIds: [finalExpression.cellId],
      returnBindingAuthorityId: "binding:lexical-return"
    }]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const result = await new GraphTokenScheduler(source, overlay, {
    providers: {
      "provider:cell:lexical-preceding-leaf": () => ({ outcomeValue: false }),
      "provider:cell:lexical-final-expression": (input, context) => ({
        outcomeValue: { enteringCarrier: context.decompositionInput, precedingLeafOutcome: input }
      })
    }
  }).execute({ scenarioId: "preserved" });
  assert.deepEqual(result.outcome, {
    enteringCarrier: { scenarioId: "preserved" },
    precedingLeafOutcome: false
  });
});

test("a decomposed transformation parent executes once against its admitted entering carrier", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const transformation = cell("cell:bound-transformation", {
    authorityId: "operation:sda-authority-transformation-port.v1",
    terminal: true
  });
  const testimonyLeaf = cell("cell:bound-transformation-testimony", { parentCellId: transformation.cellId });
  const returned = edge("edge:bound-transformation-return", "return", testimonyLeaf, transformation);
  const source = graph("decomposed-bound-transformation", transformation, [transformation, testimonyLeaf], [returned], {
    decompositions: [{
      parentCellId: transformation.cellId,
      entryCellIds: [testimonyLeaf.cellId],
      exitCellIds: [testimonyLeaf.cellId],
      returnBindingAuthorityId: "binding:bound-transformation-return"
    }]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  let parentExecutions = 0;
  const enteringCarrier = { observedFacts: [{ semanticIdentity: "interfaces.authority.json" }] };
  const result = await new GraphTokenScheduler(source, overlay, {
    providers: {
      "provider:cell:bound-transformation-testimony": () => ({ outcomeValue: "partial-child-value" }),
      "provider:cell:bound-transformation": (input) => {
        parentExecutions += 1;
        return { outcomeValue: { enteringCarrier: input, projected: true } };
      }
    }
  }).execute(enteringCarrier);
  assert.equal(parentExecutions, 1);
  assert.deepEqual(result.outcome, { enteringCarrier, projected: true });
  assert.deepEqual(result.cellTestimony.map((item) => item.cellId), [testimonyLeaf.cellId, transformation.cellId]);
});

test("a recurrence inside a decomposed branch rejoins sibling carriers at the enclosing execution scope", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const root = cell("cell:scope-root");
  const conformance = cell("cell:scope-conformance", { altitude: "scenario", kind: "scenario", slot: false });
  const loop = cell("cell:scope-loop", { parentCellId: conformance.cellId, variants: ["CONTINUE", "STOP"] });
  const conformanceDone = cell("cell:scope-conformance-done", { parentCellId: conformance.cellId });
  const review = cell("cell:scope-review");
  const joined = cell("cell:scope-joined", { terminal: true, cardinality: "named-product" });
  const broadcastEdges = [conformance, review].map((target) => edge(
    `edge:scope-broadcast:${target.cellId}`,
    "broadcast",
    root,
    target,
    { groupId: "group:scope-broadcast" }
  ));
  const recur = edge("edge:scope-recur", "recurrence", loop, loop, {
    selectsVariant: "CONTINUE",
    groupId: "group:scope-recur",
    recurrenceAuthorityId: "recurrence:scope-loop"
  });
  const stop = edge("edge:scope-stop", "selection", loop, conformanceDone, {
    selectsVariant: "STOP",
    groupId: "group:scope-stop"
  });
  const returned = edge("edge:scope-return", "return", conformanceDone, conformance);
  const joinEdges = [
    edge("edge:scope-join:findings", "join", conformance, joined, {
      groupId: "group:scope-join", joinSlotId: "findings"
    }),
    edge("edge:scope-join:review", "join", review, joined, {
      groupId: "group:scope-join", joinSlotId: "review"
    })
  ];
  const source = graph(
    "decomposed-recurrence-rejoin",
    root,
    [root, conformance, loop, conformanceDone, review, joined],
    [...broadcastEdges, recur, stop, returned, ...joinEdges],
    {
      decompositions: [{
        parentCellId: conformance.cellId,
        entryCellIds: [loop.cellId],
        exitCellIds: [conformanceDone.cellId],
        returnBindingAuthorityId: "binding:scope-return"
      }],
      edgeGroups: [
        { groupId: "group:scope-broadcast", kind: "broadcast", edgeIds: broadcastEdges.map((item) => item.edgeId), policy: "all" },
        { groupId: "group:scope-recur", kind: "recurrence", edgeIds: [recur.edgeId], policy: "bounded" },
        { groupId: "group:scope-stop", kind: "selection", edgeIds: [stop.edgeId], policy: "exactly-one", exhaustive: true, exclusive: true },
        { groupId: "group:scope-join", kind: "join", edgeIds: joinEdges.map((item) => item.edgeId), policy: "all-required", joinCellId: joined.cellId, requiredSlotIds: ["findings", "review"] }
      ],
      recurrenceAuthorities: [{
        recurrenceAuthorityId: "recurrence:scope-loop",
        continuationVariant: "CONTINUE",
        stopVariant: "STOP",
        maximumIterations: 2,
        cancellationPolicy: "immediate",
        authorityDigest: D
      }]
    }
  );
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const providers = {
    "provider:cell:scope-root": (input) => input,
    "provider:cell:scope-loop": (input) => ({
      outcomeValue: { ...input, pass: (input.pass ?? 0) + 1 },
      outcomeVariant: input.pass ? "STOP" : "CONTINUE"
    }),
    "provider:cell:scope-conformance-done": () => ({ outcomeValue: { findings: [] } }),
    "provider:cell:scope-review": () => ({ outcomeValue: { review: "AGREE" } }),
    "provider:cell:scope-joined": (input) => input
  };
  const result = await new GraphTokenScheduler(source, overlay, { providers }).execute({ pass: 0 });
  assert.deepEqual(result.outcome, { findings: { findings: [] }, review: { review: "AGREE" } });
  assert.equal(result.edgeTestimony.find((item) => item.edgeId === "edge:scope-join:findings").iterationId, undefined);
  assert.equal(result.edgeTestimony.find((item) => item.edgeId === "edge:scope-join:review").iterationId, undefined);
});

test("bounded recurrence repeats only through its admitted recurrence edge", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const loop = cell("cell:loop", { variants: ["CONTINUE", "STOP"] });
  const done = cell("cell:done", { terminal: true });
  const recur = edge("edge:recur", "recurrence", loop, loop, { selectsVariant: "CONTINUE", groupId: "group:recur", recurrenceAuthorityId: "recurrence:loop" });
  const stop = edge("edge:stop", "selection", loop, done, { selectsVariant: "STOP", groupId: "group:stop" });
  const source = graph("recurrence", loop, [loop, done], [recur, stop], {
    edgeGroups: [
      { groupId: "group:recur", kind: "recurrence", edgeIds: [recur.edgeId], policy: "bounded" },
      { groupId: "group:stop", kind: "selection", edgeIds: [stop.edgeId], policy: "exactly-one", exhaustive: true, exclusive: true }
    ],
    recurrenceAuthorities: [{ recurrenceAuthorityId: "recurrence:loop", continuationVariant: "CONTINUE", stopVariant: "STOP", maximumIterations: 3, cancellationPolicy: "immediate", authorityDigest: D }]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const providers = {
    "provider:cell:loop": (input) => ({ outcomeValue: { count: input.count + 1 }, outcomeVariant: input.count < 2 ? "CONTINUE" : "STOP" }),
    "provider:cell:done": (input) => input
  };
  const result = await new GraphTokenScheduler(source, overlay, { providers }).execute({ count: 0 });
  assert.equal(result.outcome.count, 3);
  assert.equal(result.edgeTestimony.filter((item) => item.edgeId === recur.edgeId).length, 2);
  await assert.rejects(() => new GraphTokenScheduler(source, overlay, {
    providers: { ...providers, "provider:cell:loop": (input) => ({ outcomeValue: { count: input.count + 1 }, outcomeVariant: "CONTINUE" }) }
  }).execute({ count: 0 }), /RECURRENCE_BOUND_EXCEEDED/);
});

test("recurrence consumes a declared input budget and admits every declared continuation variant", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const loop = cell("cell:budgeted-loop", { variants: ["RETRY", "REGENERATE", "STOP"] });
  const done = cell("cell:budgeted-done", { terminal: true });
  const retry = edge("edge:budgeted-retry", "recurrence", loop, loop, {
    selectsVariant: "RETRY", groupId: "group:budgeted", recurrenceAuthorityId: "recurrence:budgeted"
  });
  const regenerate = edge("edge:budgeted-regenerate", "recurrence", loop, loop, {
    selectsVariant: "REGENERATE", groupId: "group:budgeted", recurrenceAuthorityId: "recurrence:budgeted"
  });
  const stop = edge("edge:budgeted-stop", "selection", loop, done, { selectsVariant: "STOP", groupId: "group:budgeted-stop" });
  const source = graph("budgeted-recurrence", loop, [loop, done], [retry, regenerate, stop], {
    edgeGroups: [
      { groupId: "group:budgeted", kind: "recurrence", edgeIds: [retry.edgeId, regenerate.edgeId], policy: "bounded" },
      { groupId: "group:budgeted-stop", kind: "selection", edgeIds: [stop.edgeId], policy: "exactly-one", exhaustive: true, exclusive: true }
    ],
    recurrenceAuthorities: [{
      recurrenceAuthorityId: "recurrence:budgeted", continuationVariant: "RETRY", continuationVariants: ["RETRY", "REGENERATE"],
      stopVariant: "STOP", maximumIterations: 10, budgetContractId: "request.v1", budgetValuePath: "/attemptBudget",
      cancellationPolicy: "immediate", authorityDigest: D
    }]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  await assert.rejects(() => new GraphTokenScheduler(source, overlay, {
    providers: {
      "provider:cell:budgeted-loop": (input) => ({ outcomeValue: input, outcomeVariant: input.count++ % 2 ? "REGENERATE" : "RETRY" }),
      "provider:cell:budgeted-done": (input) => input
    }
  }).execute({ attemptBudget: 2, count: 0 }), /RECURRENCE_BOUND_EXCEEDED/);

  const mismatched = structuredClone(source);
  mismatched.edges.find((item) => item.edgeId === regenerate.edgeId).selectsVariant = "UNDECLARED";
  const findingCodes = new SemanticExecutionGraphValidator().validate(mismatched).findings.map((item) => item.code);
  assert.ok(findingCodes.includes("RECURRENCE_CONTINUATION_VARIANT_MISMATCH"));
});

test("route-cancelled recurrence follows its declared cancellation edge at the iteration boundary", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  const loop = cell("cell:cancel-loop", { variants: ["CONTINUE", "STOP"] });
  const done = cell("cell:cancel-done", { terminal: true });
  const cancelled = cell("cell:cancelled", { terminal: true });
  const recur = edge("edge:cancel-recur", "recurrence", loop, loop, {
    selectsVariant: "CONTINUE", groupId: "group:cancel-recur", recurrenceAuthorityId: "recurrence:cancel"
  });
  const stop = edge("edge:cancel-stop", "selection", loop, done, { selectsVariant: "STOP", groupId: "group:cancel-stop" });
  const cancel = edge("edge:cancel-route", "cancellation", loop, cancelled, { groupId: "group:cancel-route" });
  const source = graph("route-cancelled", loop, [loop, done, cancelled], [recur, stop, cancel], {
    edgeGroups: [
      { groupId: "group:cancel-recur", kind: "recurrence", edgeIds: [recur.edgeId], policy: "bounded" },
      { groupId: "group:cancel-stop", kind: "selection", edgeIds: [stop.edgeId], policy: "exactly-one", exhaustive: true, exclusive: true },
      { groupId: "group:cancel-route", kind: "cancellation", edgeIds: [cancel.edgeId], policy: "first-match" }
    ],
    recurrenceAuthorities: [{ recurrenceAuthorityId: "recurrence:cancel", continuationVariant: "CONTINUE", stopVariant: "STOP", maximumIterations: 3, cancellationPolicy: "route-cancelled", authorityDigest: D }]
  });
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  let checks = 0;
  const result = await new GraphTokenScheduler(source, overlay, {
    providers: {
      "provider:cell:cancel-loop": (input) => ({ outcomeValue: input, outcomeVariant: "CONTINUE" }),
      "provider:cell:cancel-done": (input) => input,
      "provider:cell:cancelled": (input) => ({ outcomeValue: { ...input, routedCancellation: true } })
    },
    cancelled: () => ++checks > 1
  }).execute({});
  assert.equal(result.disposition, "completed");
  assert.deepEqual(result.outcome, { routedCancellation: true });
  assert.ok(result.edgeTestimony.some((item) => item.edgeId === cancel.edgeId));
});

test("failure and cancellation use declared exceptional routes", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator } = await api();
  for (const [kind, disposition] of [["failure", "failed"], ["cancellation", "cancelled"]]) {
    const root = cell(`cell:${kind}`, { variants: [kind === "failure" ? "FAILURE" : "CANCELLED"] });
    const terminal = cell(`cell:${kind}:terminal`, { terminal: true });
    const route = edge(`edge:${kind}`, kind, root, terminal, { groupId: `group:${kind}` });
    const source = graph(kind, root, [root, terminal], [route], {
      edgeGroups: [{ groupId: `group:${kind}`, kind, edgeIds: [route.edgeId], policy: "first-match" }]
    });
    const overlay = await overlayFor(source);
    assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
    const providers = {
      [`provider:${root.cellId}`]: () => ({ outcomeValue: { routed: kind }, outcomeVariant: kind === "failure" ? "FAILURE" : "CANCELLED", disposition }),
      [`provider:${terminal.cellId}`]: (input) => input
    };
    const result = await new GraphTokenScheduler(source, overlay, { providers }).execute({});
    assert.deepEqual(result.edgeTestimony.map((item) => item.edgeId), [route.edgeId]);
  }
});

test("physical effects require a physical cell, graph context, and provider testimony", async () => {
  const { GraphTokenScheduler, SemanticExecutionGraphValidator, verifyObservedTopology } = await api();
  const physical = cell("cell:physical", { altitude: "physical", kind: "physical", primitiveProfileId: "primitive:test", terminal: true });
  const source = graph("physical", physical, [physical], []);
  const overlay = await overlayFor(source);
  assert.equal(new SemanticExecutionGraphValidator().validate(source, overlay).disposition, "ADMITTED");
  const effects = [];
  const result = await new GraphTokenScheduler(source, overlay, {
    providers: { "provider:cell:physical": async (input, context) => ({ outcomeValue: await context.invokePhysicalEffect("primitive:test", input, () => ({ effected: true })) }) },
    effectSink: (item) => effects.push(item)
  }).execute({});
  assert.equal(effects.length, 1);
  assert.equal(verifyObservedTopology(source, result.cellTestimony, result.edgeTestimony, effects).disposition, "CONFORMING");
  const injected = verifyObservedTopology(source, result.cellTestimony, result.edgeTestimony, [{ effectId: "node-only-effect" }]);
  assert.equal(injected.disposition, "NON_CONFORMING");
  assert.ok(injected.findings.some((item) => item.code === "UNDECLARED_PHYSICAL_EFFECT"));
});

test("graph admission rejects undeclared cycles, join gaps, and overlay mutation", async () => {
  const { SemanticExecutionGraphValidator } = await api();
  const a = cell("cell:a");
  const b = cell("cell:b");
  const ab = edge("edge:ab", "sequence", a, b);
  const ba = edge("edge:ba", "sequence", b, a);
  const cyclic = graph("invalid-cycle", a, [a, b], [ab, ba]);
  assert.ok(new SemanticExecutionGraphValidator().validate(cyclic).findings.some((item) => item.code === "UNDECLARED_RECURRENCE"));

  const joinEdge = edge("edge:join", "join", a, b, { groupId: "group:join", joinSlotId: "one" });
  const invalidJoin = graph("invalid-join", a, [a, b], [joinEdge], {
    edgeGroups: [{ groupId: "group:join", kind: "join", edgeIds: [joinEdge.edgeId], policy: "all-required", joinCellId: b.cellId, requiredSlotIds: ["one", "two"] }]
  });
  assert.ok(new SemanticExecutionGraphValidator().validate(invalidJoin).findings.some((item) => item.code === "JOIN_INPUT_UNSATISFIED"));

  const overlay = await overlayFor(graph("overlay", a, [a], []));
  overlay.canonicalGraphDigest = D;
  assert.ok(new SemanticExecutionGraphValidator().validate(graph("overlay", a, [a], []), overlay).findings.some((item) => item.code === "CANONICAL_TOPOLOGY_DIVERGENCE"));

  // A route may not select an outcome its source cell never declares.
  const router = cell("cell:router", { variants: ["LEFT", "RIGHT"] });
  const target = cell("cell:target", { terminal: true });
  const ghost = edge("edge:ghost", "selection", router, target, { selectsVariant: "MIDDLE", groupId: "group:ghost" });
  const undeclaredVariant = graph("undeclared-variant", router, [router, target], [ghost], {
    edgeGroups: [{ groupId: "group:ghost", kind: "selection", edgeIds: [ghost.edgeId], policy: "exactly-one", exhaustive: true, exclusive: true }]
  });
  assert.ok(new SemanticExecutionGraphValidator().validate(undeclaredVariant).findings.some((item) => item.code === "UNDECLARED_BRANCH_VARIANT"));
});

test("transformation compiler exposes conditional and collection control as topology", async () => {
  const { SemanticTransformationGraphCompiler } = await api();
  const expression = {
    op: "if",
    when: { op: "equals", left: { op: "path", from: "input", path: "enabled" }, right: { op: "literal", value: true } },
    then: { op: "map", from: { op: "path", from: "input", path: "items" }, as: "item", value: { op: "path", from: "item", path: "" } },
    else: { op: "literal", value: [] }
  };
  const fragment = new SemanticTransformationGraphCompiler().compile("transform:fixture", expression, "cell:parent");
  assert.ok(fragment.edgeGroups.some((group) => group.kind === "selection"));
  assert.ok(fragment.edges.some((item) => item.kind === "recurrence"));
  assert.ok(fragment.cells.length >= 7);
  assert.ok(fragment.cells.every((item) => item.sourcePointers.length > 0));
});

test("every admitted language target is observable and no target is silently waived", async () => {
  const { canonicalGraphDigest } = await api();
  const record = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "conformance/execution-graph/language-graph-v1-conformance.json"), "utf8"));
  const fixture = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, record.fixtureRef), "utf8"));

  // The conformance record must describe the fixture it claims to govern.
  assert.equal(record.canonicalGraphDigest, canonicalGraphDigest(fixture.plan.canonicalGraph));
  assert.equal(record.expectedObservedPathDigest, fixture.expected.observedPathDigest);

  const admission = new AjvSchemaAdmission(path.join(REPO_ROOT, "kernel/schemas"));
  assert.equal(admission.validate(record, "language-execution-graph-conformance.schema.json").valid, true);

  for (const target of record.targets) {
    assert.ok(["ADMITTED", "HELD"].includes(target.status), `${target.targetId} carries an unknown status`);
    if (target.status === "HELD") {
      // A held target must say why; silence is how a waiver hides.
      assert.ok(typeof target.reason === "string" && target.reason.length > 0, `${target.targetId} is HELD without a stated reason`);
      continue;
    }
    // An admitted target must be observable: its scheduler and its test must exist.
    for (const reference of [target.schedulerRef, target.testRef]) {
      assert.ok(
        fs.existsSync(path.join(REPO_ROOT, reference)),
        `admitted target '${target.targetId}' references '${reference}', which does not exist`
      );
    }
  }
});
