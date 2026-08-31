import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { ScenarioKernel } from "../../dist/src/kernel/scenario-kernel.js";
import { DispositionResolver } from "../../dist/src/kernel/disposition-resolver.js";
import {
  canonicalizeValue,
  createGovernedEffectContext,
  createNodeMechanicRegistry,
  createSchemaAdmission,
  createSynchronousSchemaAdmission,
  evaluateExpression,
  matchesSchema,
  observeExternalRepresentation,
  valueAt
} from "./node-mechanic-registry-loader.mjs";
import { GraphTokenScheduler, verifyObservedTopology } from "./admitted-graph-platform.mjs";
import { invokePlatformEffectMechanic } from "./platform-effect-provider.mjs";

function readDocument(url) {
  return JSON.parse(fs.readFileSync(url, "utf8"));
}

function loadPlanApplication(baseUrl, bindingRef) {
  const bindingUrl = new URL(bindingRef, baseUrl);
  const binding = readDocument(bindingUrl);
  if (!["projected-consumer-application-binding.v2", "projected-consumer-application-binding.v3"].includes(binding.bindingType)) {
    throw new Error(`CONSUMER_EXECUTION_PLAN_REQUIRED: '${String(binding.bindingType ?? "unversioned")}'.`);
  }
  const planUrl = new URL(binding.executionPlan, bindingUrl);
  const encodedPlan = fs.readFileSync(planUrl, "utf8");
  const observedDigest = `sha256:${crypto.createHash("sha256").update(encodedPlan).digest("hex")}`;
  if (observedDigest !== binding.executionPlanDigest) {
    throw new Error(`CONSUMER_EXECUTION_PLAN_DIGEST_MISMATCH: expected '${binding.executionPlanDigest}' observed '${observedDigest}'.`);
  }
  const plan = JSON.parse(encodedPlan);
  const admittedPlanTypes = binding.bindingType === "projected-consumer-application-binding.v3"
    ? ["consumer-execution-embodiment-plan.v3"]
    : ["consumer-execution-embodiment-plan.v1", "consumer-execution-embodiment-plan.v2"];
  if (!admittedPlanTypes.includes(plan.executionEmbodimentPlanType) || plan.target !== "node") {
    throw new Error("CONSUMER_EXECUTION_PLAN_NOT_ADMITTED");
  }
  return Object.freeze({
    bindingUrl,
    binding: Object.freeze(binding),
    plan: Object.freeze(plan),
    fixtures: readDocument(new URL(binding.fixtures, bindingUrl)),
    mechanicalSterility: readDocument(new URL(binding.mechanicalSterility, bindingUrl))
  });
}

function resolveMechanic(registry, binding, expectedType) {
  if (binding.mechanicType !== expectedType) {
    throw new Error(`CONSUMER_EXECUTION_PLAN_MECHANIC_TYPE_DIVERGENCE: '${binding.bindingId}'.`);
  }
  const provider = registry.get(binding.providerCapabilityId);
  if (!provider) throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: '${binding.providerCapabilityId}'`);
  return provider;
}

function resultRecord(execution) {
  return {
    executionId: execution.executionId,
    rootExecutionId: execution.rootExecutionId,
    parentExecutionId: execution.parentExecutionId,
    scenarioId: execution.scenarioId,
    disposition: execution.disposition,
    outcome: execution.outcome
  };
}

function rejectConsumerTestArtifactOverride(options = {}) {
  if (options.testExecution !== undefined || options.testArtifactRoot !== undefined || options.testArtifactRootMarker !== undefined) {
    throw new Error("TEST_ARTIFACT_OVERRIDE_NOT_AVAILABLE_TO_CONSUMERS");
  }
}

async function executeLinearPlan(application, input, options = {}) {
  const nativeEffectContext = options.nativeEffectContext ?? createGovernedEffectContext();
  options = { ...options, nativeEffectContext };
  const plan = application.plan;
  const bindings = new Map(plan.mechanicBindings.map((binding) => [binding.bindingId, binding]));
  const invokeBinding = async (bindingRef, nestedInput, nestedOptions = {}, deferred = false) => {
    const nestedApplication = loadPlanApplication(application.bindingUrl, bindingRef);
    const invoke = () => executePlan(nestedApplication, nestedInput, {
      ...nestedOptions,
      signal: nestedOptions.signal ?? options.signal,
      nativeEffectContext,
      ...(options.testExecution === true ? {
        testExecution: true,
        testArtifactRoot: options.testArtifactRoot,
        testArtifactRootMarker: options.testArtifactRootMarker
      } : {})
    });
    return deferred
      ? createDeferredInvocation(nestedApplication, invoke, nestedOptions, nativeEffectContext)
      : { application: nestedApplication, result: await invoke() };
  };
  const mechanics = createNodeMechanicRegistry({
    bindingUrl: application.bindingUrl,
    invokeBinding,
    nativeEffectContext,
    testArtifactContext: options.testExecution === true ? {
      testExecution: true,
      testArtifactRoot: options.testArtifactRoot,
      testArtifactRootMarker: options.testArtifactRootMarker
    } : undefined
  });
  const missingProviders = plan.requiredProviderCapabilityIds.filter((capabilityId) =>
    ![mechanics.contractAdmissions, mechanics.eventPorts, mechanics.stateProjections]
      .some((registry) => registry.has(capabilityId)));
  if (missingProviders.length > 0) throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: '${missingProviders.join(",")}'`);

  const contractBinding = bindings.get("contract-admission");
  if (!contractBinding) throw new Error("CONSUMER_EXECUTION_PLAN_CONTRACT_BINDING_MISSING");
  const createContractValidator = resolveMechanic(mechanics.contractAdmissions, contractBinding, "contract-admission");
  const nativeContractValidator = createContractValidator(contractBinding);
  const nodes = new Map(plan.nodes.map((node) => [node.nodeId, node]));
  const observations = [];
  const executions = [];
  const nestedExecutions = [];
  const nestedObservations = [];
  const rootExecutionId = options.rootExecutionId ?? `${plan.capabilityId}.execution`;
  const rootInput = structuredClone(input);
  const visited = new Set();
  let nodeId = options.startNodeId ?? plan.rootNodeId;
  let admittedInput = input;
  let parentExecutionId = options.parentExecutionId ?? null;

  while (nodeId) {
    if (visited.has(nodeId)) throw new Error(`CONSUMER_EXECUTION_PLAN_CYCLE: '${nodeId}'.`);
    visited.add(nodeId);
    const node = nodes.get(nodeId);
    if (!node) throw new Error(`CONSUMER_EXECUTION_PLAN_NODE_MISSING: '${nodeId}'.`);
    const executionId = parentExecutionId === null ? rootExecutionId : `${rootExecutionId}.${nodeId}`;
    let latestFailure = null;
    const contracts = {
      async admit(contract, value, signal) {
        try { return await nativeContractValidator.admit(contract, value, signal); }
        catch (error) { latestFailure ??= error; throw error; }
      }
    };
    const authorityResolver = {
      async resolve(event) {
        if (event.executionAuthorityId !== node.scenario.event.executionAuthorityId) {
          throw new Error(`CONSUMER_EXECUTION_PLAN_EVENT_DIVERGENCE: '${event.executionAuthorityId}'.`);
        }
        return { executionAuthorityId: event.executionAuthorityId, handler: node.operations };
      }
    };
    const semanticExecutor = {
      async execute(authority, candidate) {
        let produced = candidate;
        try {
          for (const operation of authority.handler) {
            if (operation.kind === "invoke-scenario") {
              if (options.ancestryNodeIds?.includes(operation.scenarioNodeId) || operation.scenarioNodeId === nodeId) {
                throw new Error(`CONSUMER_EXECUTION_PLAN_RECURSIVE_SCENARIO: '${operation.scenarioNodeId}'.`);
              }
              const nested = await executePlan(application, produced, {
                ...options,
                startNodeId: operation.scenarioNodeId,
                parentExecutionId: executionId,
                rootExecutionId,
                ancestryNodeIds: [...(options.ancestryNodeIds ?? []), nodeId]
              });
              nestedExecutions.push(...nested.executions);
              nestedObservations.push(...nested.observations);
              if (nested.disposition === "failed" || nested.disposition === "rejected") {
                throw new Error(nested.errorCode ?? `CONSUMER_EXECUTION_PLAN_NESTED_${nested.disposition.toUpperCase()}`);
              }
              produced = nested.outcome;
              continue;
            }
            const binding = bindings.get(operation.mechanicBindingId);
            if (!binding) throw new Error(`CONSUMER_EXECUTION_PLAN_BINDING_MISSING: '${operation.mechanicBindingId}'.`);
            if (operation.kind === "project-state") {
              const provider = resolveMechanic(mechanics.stateProjections, binding, "state-projection");
              produced = await provider(binding, produced, {
                rootInput, rootExecutionId, executions, nestedExecutions, signal: options.signal,
                ...(options.testExecution === true ? { testArtifactContext: {
                  testExecution: true,
                  testArtifactRoot: options.testArtifactRoot,
                  testArtifactRootMarker: options.testArtifactRootMarker
                } } : {})
              });
              continue;
            }
            const portId = binding.bindingId.replace(/^port:/, "");
            const declaredOutcome = options.portOutcomes?.[portId];
            if (declaredOutcome !== undefined) {
              produced = fixturePortOutput(portId, declaredOutcome, produced);
            } else {
              const provider = resolveMechanic(mechanics.eventPorts, binding, "event-port");
              produced = await provider(binding, produced, { rootInput, rootExecutionId, executions, nestedExecutions, signal: options.signal });
            }
          }
          return produced;
        } catch (error) { latestFailure ??= error; throw error; }
      }
    };
    const observer = { observe(observation) { observations.push(observation); } };
    const kernel = new ScenarioKernel(contracts, authorityResolver, semanticExecutor, new DispositionResolver(), observer, {
      now: () => new Date().toISOString()
    });
    const execution = await kernel.execute(node.scenario, {
      executionId,
      rootExecutionId,
      parentExecutionId,
      input: admittedInput,
      signal: options.signal
    });
    executions.push(resultRecord(execution));
    if (execution.disposition === "failed" || execution.disposition === "rejected") {
      return {
        disposition: execution.disposition,
        outcome: execution.outcome,
        executions,
        observations: [...observations, ...nestedObservations],
        ...(nestedExecutions.length > 0 ? { nestedExecutions } : {}),
        ...(latestFailure ? { errorCode: latestFailure.message } : {})
      };
    }
    if (!node.transition) {
      return {
        disposition: execution.disposition,
        outcome: execution.outcome,
        executions,
        observations: [...observations, ...nestedObservations],
        ...(nestedExecutions.length > 0 ? { nestedExecutions } : {})
      };
    }
    if (node.transition.mechanicBindingId === null) admittedInput = execution.outcome;
    else {
      const binding = bindings.get(node.transition.mechanicBindingId);
      if (!binding) throw new Error(`CONSUMER_EXECUTION_PLAN_BINDING_MISSING: '${node.transition.mechanicBindingId}'.`);
      const provider = resolveMechanic(mechanics.stateProjections, binding, "state-projection");
      admittedInput = await provider(binding, execution.outcome, { rootInput, rootExecutionId, executions, nestedExecutions });
    }
    parentExecutionId = executionId;
    nodeId = node.transition.nextNodeId;
  }
  throw new Error("CONSUMER_EXECUTION_PLAN_TERMINATED_WITHOUT_RESULT");
}

function scenarioIdForCell(graph, cellId) {
  const cells = new Map(graph.cells.map((cell) => [cell.cellId, cell]));
  let cell = cells.get(cellId);
  while (cell && cell.altitude !== "scenario") cell = cell.parentCellId ? cells.get(cell.parentCellId) : undefined;
  return cell?.altitude === "scenario" ? cell.semanticAddress.split("/scenario/").at(-1) : undefined;
}

function fixtureTerminalCells(graph) {
  const decompositionByParent = new Map(graph.decompositions.map((item) => [item.parentCellId, item]));
  const result = new Map();
  for (const cell of graph.cells.filter((item) => item.altitude === "scenario")) {
    const decomposition = decompositionByParent.get(cell.cellId);
    const cursor = decomposition?.exitCellIds.at(-1) ?? cell.cellId;
    if (cursor) result.set(cursor, scenarioIdForCell(graph, cell.cellId));
  }
  return result;
}

function resolveFixtureGraphValue(value, catalog, stack = []) {
  if (Array.isArray(value)) return value.map((item) => resolveFixtureGraphValue(item, catalog, stack));
  if (!value || typeof value !== "object") return value;
  if (Object.keys(value).length === 1 && typeof value.$fixtureRef === "string") {
    const reference = value.$fixtureRef;
    if (!Object.hasOwn(catalog, reference)) throw new Error(`FIXTURE_GRAPH_OUTCOME_REFERENCE_MISSING: '${reference}'.`);
    if (stack.includes(reference)) throw new Error(`FIXTURE_GRAPH_OUTCOME_REFERENCE_CYCLE: '${[...stack, reference].join(" -> ")}'.`);
    return resolveFixtureGraphValue(catalog[reference], catalog, [...stack, reference]);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveFixtureGraphValue(item, catalog, stack)]));
}

function createDeferredInvocation(application, invoke, nestedOptions, nativeEffectContext) {
  const executeFixture = async (fixtureId) => {
    const fixture = application.fixtures.fixtures.find((candidate) => candidate.fixtureId === fixtureId);
    if (!fixture) throw new Error(`UNKNOWN_PROJECTED_FIXTURE: '${fixtureId}'.`);
    const testArtifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-projected-fixture-"));
    const testArtifactRootMarker = crypto.randomUUID();
    fs.writeFileSync(path.join(testArtifactRoot, ".sda-test-artifact-root.json"), JSON.stringify({
      marker: testArtifactRootMarker,
      root: testArtifactRoot
    }), "utf8");
    try {
      const fixtureCatalog = { ...(application.fixtures.graphOutcomeCatalog ?? {}), ...(fixture.graphOutcomeCatalog ?? {}) };
      const result = await executePlan(application, resolveFixtureGraphValue(fixture.input, fixtureCatalog), {
        rootExecutionId: nestedOptions.rootExecutionId,
        portOutcomes: { ...(application.fixtures.portOutcomes ?? {}), ...(fixture.portOutcomes ?? {}) },
        graphOutcomes: fixture.graphOutcomes,
        graphOutcomeCatalog: fixtureCatalog,
        testExecution: true,
        testArtifactRoot,
        testArtifactRootMarker,
        nativeEffectContext
      });
      return { fixture, result, conformance: evaluatePlanConformance(application, result) };
    } finally {
      fs.rmSync(testArtifactRoot, { recursive: true, force: true });
    }
  };
  return {
    application,
    execute: invoke,
    executeFixture
  };
}

function fixturePortOutput(portId, declared, input) {
  const selected = declared?.byCarrierType?.[input?.carrierType] ?? declared;
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
    throw new Error(`FIXTURE_PORT_OUTCOME_INVALID: '${portId}'.`);
  }
  if (selected.status === "FAILURE") {
    throw new Error(selected.error?.code ?? `FIXTURE_PORT_FAILURE: '${portId}'.`);
  }
  if (Object.hasOwn(selected, "output")) return structuredClone(selected.output);
  if (!Object.hasOwn(selected, "status")) return structuredClone(selected);
  throw new Error(`FIXTURE_PORT_OUTPUT_MISSING: '${portId}'.`);
}

function graphProviders(application, graphOutcomes = {}, graphOutcomeCatalog = {}, rootInput = null, portOutcomes = {}, options = {}) {
  const plan = application.plan;
  const terminalCells = fixtureTerminalCells(plan.canonicalGraph);
  const cellById = new Map(plan.canonicalGraph.cells.map((cell) => [cell.cellId, cell]));
  const occurrenceByScenario = new Map();
  const collectionOccurrenceByCell = new Map();
  const nestedExecutions = [];
  const nativeEffectContext = options.nativeEffectContext ?? createGovernedEffectContext();
  const invokeBinding = async (bindingRef, nestedInput, nestedOptions = {}, deferred = false) => {
    const nestedApplication = loadPlanApplication(application.bindingUrl, bindingRef);
    const invoke = () => executePlan(nestedApplication, nestedInput, {
      ...nestedOptions,
      signal: nestedOptions.signal ?? options.signal,
      nativeEffectContext
    });
    return deferred
      ? createDeferredInvocation(nestedApplication, invoke, nestedOptions, nativeEffectContext)
      : { application: nestedApplication, result: await invoke() };
  };
  const mechanics = createNodeMechanicRegistry({
    bindingUrl: application.bindingUrl,
    invokeBinding,
    nativeEffectContext,
    testArtifactContext: options.testExecution === true ? {
      testExecution: true,
      testArtifactRoot: options.testArtifactRoot,
      testArtifactRootMarker: options.testArtifactRootMarker
    } : undefined
  });
  const provider = async (input, context) => {
    const scenarioId = terminalCells.get(context.cellId);
    const configuration = context.configuration;
    const portId = configuration?.kind === "invoke-port" && typeof configuration.portId === "string"
      ? configuration.portId
      : cellById.get(context.cellId)?.semanticAddress.split("#/")[0];
    const portOutcome = portId ? portOutcomes[portId] : undefined;
    const declared = (scenarioId ? graphOutcomes[scenarioId] : undefined) ?? (
      portOutcome !== undefined ? { outcomeValue: fixturePortOutput(portId, portOutcome, input) } : undefined
    );
    if (declared !== undefined) {
      const occurrenceKey = scenarioId ?? portId;
      const occurrence = occurrenceByScenario.get(occurrenceKey) ?? 0;
      occurrenceByScenario.set(occurrenceKey, occurrence + 1);
      const selected = Array.isArray(declared) ? declared[Math.min(occurrence, declared.length - 1)] : declared;
      if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
        throw new Error(`FIXTURE_GRAPH_OUTCOME_INVALID: '${occurrenceKey}'.`);
      }
      const referencedValue = typeof selected.outcomeRef === "string" ? graphOutcomeCatalog[selected.outcomeRef] : undefined;
      if (typeof selected.outcomeRef === "string" && referencedValue === undefined) {
        throw new Error(`FIXTURE_GRAPH_OUTCOME_REFERENCE_MISSING: '${selected.outcomeRef}'.`);
      }
      const fixtureValue = resolveFixtureGraphValue(selected.outcomeValue ?? referencedValue ?? (
        rootInput !== null && typeof rootInput === "object" && !Array.isArray(rootInput)
          ? { ...structuredClone(rootInput), ...(selected.outcomeVariant ? { outcomeVariant: selected.outcomeVariant } : {}) }
          : input
      ), graphOutcomeCatalog);
      return {
        outcomeValue: structuredClone(fixtureValue),
        ...(selected.outcomeVariant ? { outcomeVariant: selected.outcomeVariant } : {}),
        ...(selected.disposition ? { disposition: selected.disposition } : {})
      };
    }
    if (configuration?.kind === "invoke-port" && configuration.binding) {
      const sourceBinding = configuration.binding;
      const platformCapabilityId = sourceBinding.platformCapabilityId;
      const operationKind = sourceBinding.configuration?.operationKind;
      if (operationKind && operationKind !== "invoke-port") {
        const outcomeValue = await invokePlatformEffectMechanic(operationKind, {
          bindingUrl: application.bindingUrl,
          input,
          configuration: sourceBinding.configuration,
          options
        });
        return { outcomeValue };
      }
      const eventPort = mechanics.eventPorts.get(platformCapabilityId);
      if (!eventPort) throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: '${platformCapabilityId}'`);
      const binding = Object.freeze({
        bindingId: `port:${sourceBinding.portId}`,
        mechanicType: "event-port",
        providerCapabilityId: platformCapabilityId,
        configuration: Object.freeze({ ...(sourceBinding.configuration ?? {}) })
      });
      const outcomeValue = await eventPort(binding, input, {
        rootInput,
        rootExecutionId: context.rootExecutionId,
        executions: [],
        nestedExecutions,
        signal: options.signal,
        ...(options.testExecution === true ? { testArtifactContext: {
          testExecution: true,
          testArtifactRoot: options.testArtifactRoot,
          testArtifactRootMarker: options.testArtifactRootMarker
        } } : {})
      });
      return { outcomeValue };
    }
    const expression = configuration?.binding?.configuration?.expression ?? configuration;
    if (expression && typeof expression === "object" && typeof expression.op === "string") {
      try {
        const transformationInput = context.decompositionInput ?? input;
        const outcomeValue = evaluateExpression(expression, { input: transformationInput, root: rootInput });
        if (outcomeValue === undefined) {
          const pathScope = expression.op === "path" ? (expression.from ?? "input") : null;
          if (pathScope === "input" || pathScope === "root") return { outcomeValue: false, outcomeVariant: "FALSE" };
          throw new Error("LEXICAL_BINDING_NOT_AVAILABLE_AT_CELL_ALTITUDE");
        }
        if (["map", "flat-map", "filter", "find", "some", "every"].includes(expression.op)) {
          const occurrence = collectionOccurrenceByCell.get(context.cellId) ?? 0;
          collectionOccurrenceByCell.set(context.cellId, occurrence + 1);
          const source = expression.from ? evaluateExpression(expression.from, { input: transformationInput, root: rootInput }) : [];
          const iterations = Array.isArray(source) ? source.length : 0;
          return { outcomeValue, outcomeVariant: occurrence < iterations ? "CONTINUE" : "STOP" };
        }
        return { outcomeValue };
      } catch {
        // A nested AST cell may reference a lexical binding owned by an
        // ancestor `let`/collection cell. The ancestor executes the admitted
        // expression with the complete lexical scope; this cell still records
        // its declared topology without inventing a partial binding value.
        return { outcomeValue: input, outcomeVariant: "VALUE" };
      }
    }
    if (context.authorityId === "mechanic:identity.v1") {
      return { outcomeValue: input, outcomeVariant: "VALUE" };
    }
    throw new Error(`UNDECLARED_EXECUTION_MECHANIC: '${context.cellId}'.`);
  };
  return Object.freeze({
    providers: Object.freeze(Object.fromEntries(
      [...new Set(plan.realizationOverlay.providerBindings.map((binding) => binding.providerProfileId))]
        .map((profileId) => [profileId, provider])
    )),
    nestedExecutions,
    async projectBinding(bindingAuthorityId, input, context) {
      const authority = application.plan.bindingAuthorities.find((candidate) => candidate.id === bindingAuthorityId);
      if (!authority) throw new Error(`EDGE_BINDING_AUTHORITY_MISSING: '${bindingAuthorityId}'.`);
      const sourceBinding = authority.binding;
      if (!sourceBinding) throw new Error(`EDGE_BINDING_REALIZATION_MISSING: '${bindingAuthorityId}'.`);
      const platformCapabilityId = sourceBinding.platformCapabilityId;
      const projector = mechanics.stateProjections.get(platformCapabilityId);
      if (!projector) throw new Error(`MISSING_SDA_PLATFORM_CAPABILITY: '${platformCapabilityId}'`);
      return projector(Object.freeze({
        bindingId: `projection:${bindingAuthorityId}`,
        mechanicType: "state-projection",
        providerCapabilityId: platformCapabilityId,
        configuration: Object.freeze({ ...(sourceBinding.configuration ?? {}) })
      }), input, {
        rootInput,
        rootExecutionId: context.rootExecutionId,
        executions: [],
        nestedExecutions,
        signal: options.signal
      });
    }
  });
}

async function executeGraphPlan(application, input, options = {}) {
  const runtime = graphProviders(application, options.graphOutcomes, options.graphOutcomeCatalog, input, options.portOutcomes, options);
  const contractAdmission = createSynchronousSchemaAdmission(application.plan.contractCatalog);
  const graphResult = await new GraphTokenScheduler(application.plan.canonicalGraph, application.plan.realizationOverlay, {
    providers: runtime.providers,
    rootExecutionId: options.rootExecutionId,
    cancelled: () => options.signal?.aborted === true,
    admitContract: (contractId, value) => contractAdmission.admits(contractId, value),
    projectBinding: runtime.projectBinding
  }).execute(input);
  const executions = graphResult.cellTestimony
    .filter((item) => item.cellAltitude === "scenario")
    .map((item) => ({
      executionId: item.cellExecutionId,
      rootExecutionId: item.rootExecutionId,
      parentExecutionId: item.parentCellExecutionId,
      scenarioId: scenarioIdForCell(application.plan.canonicalGraph, item.cellId),
      disposition: item.disposition,
      outcome: null
    }));
  return {
    disposition: graphResult.disposition === "completed" ? "terminated" : graphResult.disposition,
    outcome: graphResult.outcome,
    executions,
    observations: [],
    graphExecution: graphResult,
    ...(runtime.nestedExecutions.length > 0 ? { nestedExecutions: runtime.nestedExecutions } : {})
  };
}

function executePlan(application, input, options = {}) {
  return application.plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3"
    ? executeGraphPlan(application, input, options)
    : executeLinearPlan(application, input, options);
}

function evaluateLinearPlanConformance(application, observedExecution = null) {
  const mechanics = createNodeMechanicRegistry({
    bindingUrl: application.bindingUrl,
    invokeBinding: () => { throw new Error("Nested invocation is unavailable during evidence evaluation."); }
  });
  const closures = Object.fromEntries(application.plan.conformance.closures.map((closure) => {
    let findings;
    if (closure.evaluation === "compiled") findings = closure.findings;
    else {
      const evaluator = mechanics.evidenceEvaluators.get(closure.evaluatorId);
      findings = evaluator ? evaluator(closure.configuration, {
        observedExecution,
        mechanicalSterility: application.mechanicalSterility
      }) : [{ code: "PROJECTION_CLOSURE_INCOMPLETE", context: { closureId: closure.closureId } }];
    }
    return [closure.closureId, {
      closureId: closure.closureId,
      disposition: findings.length === 0 ? "PASS" : "FAIL",
      findings
    }];
  }));
  const findings = Object.values(closures).flatMap((closure) => closure.findings);
  return {
    queryId: application.plan.conformance.queryId,
    capabilityId: application.plan.capabilityId,
    closures,
    platformMechanics: {
      disposition: application.plan.conformance.platformMechanics.disposition,
      resolutions: application.plan.conformance.platformMechanics.resolutions
    },
    executableOrigin: application.plan.conformance.executableOrigin.disposition,
    admissionDisposition: findings.length === 0 ? "ADMITTED" : "REJECTED",
    findings
  };
}

function evaluateGraphPlanConformance(application, observedExecution = null) {
  const topology = observedExecution?.graphExecution
    ? verifyObservedTopology(application.plan.canonicalGraph, observedExecution.graphExecution.cellTestimony, observedExecution.graphExecution.edgeTestimony)
    : { disposition: "NON_CONFORMING", findings: [{ code: "EXECUTION_NOT_OBSERVED" }] };
  const findings = topology.findings ?? [];
  const closures = Object.fromEntries(application.plan.conformanceClosures.map((closureId) => [closureId, {
    closureId,
    disposition: findings.length === 0 ? "PASS" : "FAIL",
    findings
  }]));
  return {
    queryId: "semantic-execution-graph-conformance",
    capabilityId: application.plan.capabilityId,
    closures,
    platformMechanics: { disposition: "RESOLVED", resolutions: [] },
    executableOrigin: "PROJECTED_ONLY",
    admissionDisposition: findings.length === 0 ? "ADMITTED" : "REJECTED",
    findings
  };
}

function evaluatePlanConformance(application, observedExecution = null) {
  return application.plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3"
    ? evaluateGraphPlanConformance(application, observedExecution)
    : evaluateLinearPlanConformance(application, observedExecution);
}

function bind(baseUrl, bindingRef) {
  const application = loadPlanApplication(baseUrl, bindingRef);
  return (input, options = {}) => {
    rejectConsumerTestArtifactOverride(options);
    return executePlan(application, input, options);
  };
}

bind.conformance = (baseUrl, bindingRef) => {
  const application = loadPlanApplication(baseUrl, bindingRef);
  return (observedExecution) => evaluatePlanConformance(application, observedExecution);
};

export function projectedCliExitCode(result) {
  if (result.disposition !== "terminated") return 1;
  return result.outcome?.interfaceExitDisposition === "NONZERO" ? 1 : 0;
}

bind.cli = async (baseUrl, bindingRef) => {
  const application = loadPlanApplication(baseUrl, bindingRef);
  const encodedInput = process.argv[2] ?? (!process.stdin.isTTY ? fs.readFileSync(0, "utf8").trim() : "");
  if (!encodedInput) throw new Error("Expected canonical JSON input as one argument or on stdin.");
  if (encodedInput.startsWith("--fixture=")) {
    const fixtureId = encodedInput.slice("--fixture=".length);
    const fixture = application.fixtures.fixtures.find((candidate) => candidate.fixtureId === fixtureId);
    if (!fixture) throw new Error(`UNKNOWN_PROJECTED_FIXTURE: '${fixtureId}'.`);
    const testArtifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-projected-fixture-"));
    const testArtifactRootMarker = crypto.randomUUID();
    try {
      fs.writeFileSync(path.join(testArtifactRoot, ".sda-test-artifact-root.json"), JSON.stringify({
        marker: testArtifactRootMarker,
        root: testArtifactRoot
      }), "utf8");
      const fixtureCatalog = { ...(application.fixtures.graphOutcomeCatalog ?? {}), ...(fixture.graphOutcomeCatalog ?? {}) };
      const result = await executePlan(application, resolveFixtureGraphValue(fixture.input, fixtureCatalog), {
        portOutcomes: { ...(application.fixtures.portOutcomes ?? {}), ...(fixture.portOutcomes ?? {}) },
        graphOutcomes: fixture.graphOutcomes,
        graphOutcomeCatalog: fixtureCatalog,
        testExecution: true,
        testArtifactRoot,
        testArtifactRootMarker
      });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.disposition === fixture.expected.disposition ? 0 : 1;
    } finally {
      fs.rmSync(testArtifactRoot, { recursive: true, force: true });
    }
    return;
  }
  let input;
  try {
    input = JSON.parse(encodedInput);
  } catch (error) {
    if (encodedInput.startsWith("{") || encodedInput.startsWith("[") || encodedInput.startsWith('"')) throw error;
    input = encodedInput;
  }
  const result = await executePlan(application, input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = projectedCliExitCode(result);
};

bind.tests = (baseUrl, bindingRef) => {
  const application = loadPlanApplication(baseUrl, bindingRef);
  test("projected conformance requires observed execution", () => {
    const result = evaluatePlanConformance(application);
    assert.equal(result.admissionDisposition, "REJECTED");
    assert.ok(result.findings.some((item) => item.code === "EXECUTION_NOT_OBSERVED"));
  });
  for (const fixture of application.fixtures.fixtures) {
    test(`projected consumer circuit: ${fixture.fixtureId}`, async (t) => {
      const testArtifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sda-projected-fixture-"));
      const testArtifactRootMarker = crypto.randomUUID();
      fs.writeFileSync(path.join(testArtifactRoot, ".sda-test-artifact-root.json"), JSON.stringify({
        marker: testArtifactRootMarker,
        root: testArtifactRoot
      }), "utf8");
      t.after(() => fs.rmSync(testArtifactRoot, { recursive: true, force: true }));
      const fixtureCatalog = { ...(application.fixtures.graphOutcomeCatalog ?? {}), ...(fixture.graphOutcomeCatalog ?? {}) };
      const result = await executePlan(application, resolveFixtureGraphValue(fixture.input, fixtureCatalog), {
        portOutcomes: { ...(application.fixtures.portOutcomes ?? {}), ...(fixture.portOutcomes ?? {}) },
        graphOutcomes: fixture.graphOutcomes,
        graphOutcomeCatalog: fixtureCatalog,
        testExecution: true,
        testArtifactRoot,
        testArtifactRootMarker
      });
      assert.equal(result.disposition, fixture.expected.disposition, result.errorCode ?? JSON.stringify(result.findings ?? result.outcome ?? null));
      const observedScenarios = result.executions.map((item) => item.scenarioId);
      if (application.plan.executionEmbodimentPlanType === "consumer-execution-embodiment-plan.v3" && fixture.expected.scenarioSequence.length === 1) {
        assert.equal(observedScenarios[0], fixture.expected.scenarioSequence[0]);
        assert.ok(result.graphExecution.edgeTestimony.some((item) => item.groupId), "Graph-native fixture must testify to grouped topology.");
      } else assert.deepEqual(observedScenarios, fixture.expected.scenarioSequence);
      for (const expectation of fixture.expected.outcomeAssertions ?? []) {
        const actual = valueAt(result.outcome, expectation.path);
        if (expectation.operator === "equals") assert.deepEqual(actual, expectation.value);
        else if (expectation.operator === "contains") assert.ok(actual.includes(expectation.value));
        else if (expectation.operator === "not-contains") assert.ok(!actual.includes(expectation.value));
      }
      const conformance = evaluatePlanConformance(application, result);
      assert.equal(conformance.admissionDisposition, "ADMITTED", JSON.stringify(conformance.findings));
      assert.equal(conformance.platformMechanics.disposition, "RESOLVED");
      assert.ok(conformance.platformMechanics.resolutions.every((item) => item.status === "AVAILABLE"));
      assert.equal(conformance.executableOrigin, "PROJECTED_ONLY");
    });
  }
};

export const platformMechanics = Object.freeze({
  readDocument,
  canonicalize(value) { return JSON.stringify(canonicalizeValue(value)); },
  admitSchema(schema, value) {
    if (!matchesSchema(schema, value)) throw new Error("Canonical value rejected by schema authority.");
    return value;
  },
  createContractAdmission(contractAuthorities) {
    const admission = createSchemaAdmission(contractAuthorities);
    return (contract, value, signal) => admission.admit(contract, value, signal);
  },
  invokeScenario(application, input, options = {}) {
    rejectConsumerTestArtifactOverride(options);
    return executePlan(application, input, options);
  },
  observeExternalRepresentation,
  async invokeProjectedCapability(bindingRef, input, options = {}) {
    rejectConsumerTestArtifactOverride(options);
    const application = loadPlanApplication(options.baseUrl ?? import.meta.url, bindingRef);
    return executePlan(application, input, { rootExecutionId: options.rootExecutionId });
  },
  evaluateTransformation(expression, scope) { return evaluateExpression(expression, scope); },
  projectTransition(bindingAuthority) {
    if (!Object.hasOwn(bindingAuthority, "output")) throw new Error("MISSING_SDA_PLATFORM_CAPABILITY: transition binding has no output authority.");
    return bindingAuthority.output;
  },
  projectRuntime(canonicalAuthority) { return structuredClone(canonicalAuthority); },
  async deliverInterface(encodedInput, invoker) { return JSON.stringify(await invoker(JSON.parse(encodedInput))); },
  deliverArtifact(outcome, destination = process.stdout) { destination.write(`${JSON.stringify(outcome)}\n`); }
});

export default bind;
