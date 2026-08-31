import crypto from "node:crypto";
import { SemanticExecutionGraphCompiler, createPlanV3, resolveRealizationOverlay } from "../../../../../languages/typescript/runtimes/node/semantic-execution-graph/index.js";
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        const record = value;
        return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
    }
    return value;
}
function digest(value) {
    return `sha256:${crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}
function record(value, label) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new Error(`CONSUMER_EXECUTION_PLAN_INVALID_${label}`);
    return value;
}
function records(value, label) {
    if (!Array.isArray(value))
        throw new Error(`CONSUMER_EXECUTION_PLAN_INVALID_${label}`);
    return value.map((item) => record(item, label));
}
function text(value, label) {
    if (typeof value !== "string" || value.length === 0)
        throw new Error(`CONSUMER_EXECUTION_PLAN_INVALID_${label}`);
    return value;
}
function finding(code, context = {}) {
    return Object.freeze({ code, context: Object.freeze({ ...context }) });
}
function compiledClosure(closureId, findings) {
    return Object.freeze({
        closureId,
        evaluation: "compiled",
        disposition: findings.length === 0 ? "PASS" : "FAIL",
        findings: Object.freeze([...findings])
    });
}
function runtimeClosure(closureId, evaluatorId, configuration) {
    return Object.freeze({ closureId, evaluation: "runtime-evidence", evaluatorId, configuration: Object.freeze({ ...configuration }) });
}
function resolution(query, requiredBy, requestedCapabilityId) {
    const mechanicResolution = record(query.mechanicResolution, "MECHANIC_RESOLUTION");
    const matches = records(mechanicResolution.resolutions, "MECHANIC_RESOLUTIONS").filter((candidate) => candidate.requiredBy === requiredBy && candidate.requestedCapabilityId === requestedCapabilityId && candidate.status === "AVAILABLE");
    if (matches.length !== 1) {
        throw new Error(`CONSUMER_EXECUTION_PROVIDER_RESOLUTION_FAILED: '${requiredBy}' '${requestedCapabilityId}' resolved ${matches.length} providers.`);
    }
    return matches[0];
}
function bindingFromResolution(bindingId, mechanicType, selected, configuration) {
    return Object.freeze({
        bindingId,
        mechanicType,
        providerCapabilityId: text(selected.capabilityId, "PROVIDER_CAPABILITY_ID"),
        provider: text(selected.provider, "PROVIDER"),
        implementationRef: text(selected.implementationRef, "IMPLEMENTATION_REF"),
        configuration: Object.freeze({ ...configuration })
    });
}
function contractReference(value) {
    const source = record(value, "CONTRACT_REFERENCE");
    return Object.freeze({
        contractId: text(source.contractId, "CONTRACT_ID"),
        ...(typeof source.contractVersion === "string" ? { contractVersion: source.contractVersion } : {}),
        ...(typeof source.schemaRef === "string" ? { schemaRef: source.schemaRef } : {})
    });
}
function normalizedScenario(value) {
    const input = record(value.input, "SCENARIO_INPUT");
    const event = record(value.event, "SCENARIO_EVENT");
    const outcome = record(value.outcome, "SCENARIO_OUTCOME");
    return Object.freeze({
        scenarioId: text(value.scenarioId, "SCENARIO_ID"),
        input: Object.freeze({ inputId: text(input.inputId, "INPUT_ID"), contract: contractReference(input.contract) }),
        event: Object.freeze({
            eventId: text(event.eventId, "EVENT_ID"),
            executionAuthorityId: text(event.executionAuthorityId, "EXECUTION_AUTHORITY_ID")
        }),
        outcome: Object.freeze({
            outcomeId: text(outcome.outcomeId, "OUTCOME_ID"),
            contract: contractReference(outcome.contract),
            terminal: outcome.terminal === true
        })
    });
}
function staticFindings(closureId, query) {
    const graph = record(query.authorityGraph, "AUTHORITY_GRAPH");
    const scenarios = records(graph.scenarios, "SCENARIOS");
    const transitions = records(graph.transitions, "TRANSITIONS");
    const executions = records(graph.executionAuthorities, "EXECUTION_AUTHORITIES");
    const projections = records(graph.projectionAuthorities, "PROJECTION_AUTHORITIES");
    const interfaces = record(graph.interfaceAuthority, "INTERFACE_AUTHORITY");
    const expected = record(query.expectedTelemetry, "EXPECTED_TELEMETRY");
    const traces = records(expected.scenarios, "EXPECTED_SCENARIOS");
    const mechanicResolution = record(query.mechanicResolution, "MECHANIC_RESOLUTION");
    if (closureId === "feature-to-scenario")
        return scenarios.flatMap((scenario) => scenario.gherkin ? [] : [finding("FEATURE_SCENARIO_GAP", { scenarioId: scenario.scenarioId })]);
    if (closureId === "scenario-to-contract")
        return scenarios.flatMap((scenario) => {
            const input = record(scenario.input, "SCENARIO_INPUT");
            const outcome = record(scenario.outcome, "SCENARIO_OUTCOME");
            const inputContract = input.contract === undefined ? null : record(input.contract, "INPUT_CONTRACT");
            const outcomeContract = outcome.contract === undefined ? null : record(outcome.contract, "OUTCOME_CONTRACT");
            return [
                ...(!inputContract?.contractId ? [finding("MISSING_INPUT_CONTRACT", { scenarioId: scenario.scenarioId })] : []),
                ...(!outcomeContract?.contractId ? [finding("MISSING_OUTCOME_CONTRACT", { scenarioId: scenario.scenarioId })] : [])
            ];
        });
    if (closureId === "scenario-to-event-authority")
        return scenarios.flatMap((scenario) => {
            const event = record(scenario.event, "SCENARIO_EVENT");
            const authority = executions.find((candidate) => candidate.id === event.executionAuthorityId);
            if (!authority)
                return [finding("MISSING_EXECUTION_AUTHORITY", { scenarioId: scenario.scenarioId })];
            return authority.owningScenarioId === scenario.scenarioId ? []
                : [finding("EXECUTION_AUTHORITY_OWNERSHIP_MISMATCH", { scenarioId: scenario.scenarioId })];
        });
    if (closureId === "outcome-to-transition")
        return scenarios.flatMap((scenario) => {
            const outcome = record(scenario.outcome, "SCENARIO_OUTCOME");
            const outgoing = transitions.filter((transition) => record(transition.from, "TRANSITION_FROM").scenarioId === scenario.scenarioId);
            const invokedByComposition = executions.some((authority) => records(authority.operations, "EXECUTION_OPERATIONS")
                .some((operation) => operation.kind === "invoke-scenario" && operation.scenarioId === scenario.scenarioId));
            if (outcome.terminal !== true && outgoing.length === 0 && !invokedByComposition)
                return [finding("OPEN_BEHAVIORAL_PATH", { scenarioId: scenario.scenarioId })];
            if (outcome.terminal === true && outgoing.length > 0)
                return [finding("TERMINAL_SCENARIO_HAS_TRANSITION", { scenarioId: scenario.scenarioId })];
            return [];
        });
    if (closureId === "transition-to-next-input")
        return transitions.flatMap((transition) => {
            const fromEndpoint = record(transition.from, "TRANSITION_FROM");
            const toEndpoint = record(transition.to, "TRANSITION_TO");
            const from = scenarios.find((scenario) => scenario.scenarioId === fromEndpoint.scenarioId);
            const to = scenarios.find((scenario) => scenario.scenarioId === toEndpoint.scenarioId);
            if (!from || !to)
                return [finding("MISSING_TRANSITION_SCENARIO", { transitionId: transition.transitionId })];
            const fromOutcome = record(from.outcome, "SCENARIO_OUTCOME");
            const toInput = record(to.input, "SCENARIO_INPUT");
            const conforming = fromOutcome.outcomeId === fromEndpoint.outcomeId &&
                record(fromOutcome.contract, "OUTCOME_CONTRACT").contractId === fromEndpoint.contractId &&
                toInput.inputId === toEndpoint.inputId && record(toInput.contract, "INPUT_CONTRACT").contractId === toEndpoint.contractId;
            return conforming ? [] : [finding("TRANSITION_ENDPOINT_MISMATCH", { transitionId: transition.transitionId })];
        });
    if (closureId === "scenario-to-interface") {
        const admitted = new Set(records(graph.admittedPlatformCapabilities, "ADMITTED_PLATFORM_CAPABILITIES").map((item) => item.capabilityId));
        const findings = records(interfaces.interfaces, "INTERFACES").flatMap((binding) => scenarios.some((scenario) => scenario.scenarioId === binding.rootScenarioId) && admitted.has(binding.platformCapabilityId)
            ? [] : [finding("INTERFACE_CLOSURE_GAP", { interfaceId: binding.interfaceId })]);
        for (const scenario of scenarios) {
            const event = record(scenario.event, "SCENARIO_EVENT");
            const authority = executions.find((item) => item.id === event.executionAuthorityId);
            for (const operation of authority ? records(authority.operations, "EXECUTION_OPERATIONS") : []) {
                if (operation.kind === "invoke-port" && !records(interfaces.portBindings, "PORT_BINDINGS").some((binding) => binding.portId === operation.portId && admitted.has(binding.platformCapabilityId))) {
                    findings.push(finding("MISSING_SDA_PLATFORM_CAPABILITY", { portId: operation.portId }));
                }
            }
        }
        return findings;
    }
    if (closureId === "execution-to-telemetry")
        return scenarios.flatMap((scenario) => traces.some((trace) => trace.scenarioId === scenario.scenarioId && Array.isArray(trace.steps) && trace.steps.length > 0)
            ? [] : [finding("MISSING_EXPECTED_TELEMETRY", { scenarioId: scenario.scenarioId })]);
    if (closureId === "scenario-to-projection")
        return transitions.flatMap((transition) => {
            const from = record(transition.from, "TRANSITION_FROM");
            const to = record(transition.to, "TRANSITION_TO");
            if (from.contractId === to.contractId)
                return [];
            const projection = projections.find((item) => item.id === transition.bindingAuthorityId);
            return projection && record(projection.inputContract, "PROJECTION_INPUT_CONTRACT").contractId === from.contractId &&
                record(projection.outputContract, "PROJECTION_OUTPUT_CONTRACT").contractId === to.contractId
                ? [] : [finding("MISSING_OR_INCOMPATIBLE_PROJECTION", { transitionId: transition.transitionId })];
        });
    if (closureId === "root-to-terminal-behavior") {
        const reached = new Set();
        const pending = [graph.rootScenarioId];
        while (pending.length > 0) {
            const scenarioId = pending.shift();
            if (reached.has(scenarioId))
                continue;
            reached.add(scenarioId);
            for (const transition of transitions.filter((item) => record(item.from, "TRANSITION_FROM").scenarioId === scenarioId)) {
                pending.push(record(transition.to, "TRANSITION_TO").scenarioId);
            }
            const authority = executions.find((item) => item.owningScenarioId === scenarioId);
            for (const operation of authority ? records(authority.operations, "EXECUTION_OPERATIONS") : []) {
                if (operation.kind === "invoke-scenario")
                    pending.push(operation.scenarioId);
            }
        }
        const terminals = scenarios.filter((scenario) => record(scenario.outcome, "SCENARIO_OUTCOME").terminal === true);
        return reached.size === scenarios.length && terminals.length > 0 && terminals.every((scenario) => reached.has(scenario.scenarioId))
            ? [] : [finding("BEHAVIORAL_CLOSURE_GAP", { reachedScenarioIds: [...reached] })];
    }
    if (closureId === "required-mechanic-to-platform-capability")
        return records(mechanicResolution.resolutions, "MECHANIC_RESOLUTIONS")
            .flatMap((candidate) => candidate.status === "AVAILABLE" ? [] : [finding("MISSING_SDA_PLATFORM_CAPABILITY", {
                mechanicId: candidate.mechanicId,
                projectionTarget: mechanicResolution.projectionTarget,
                capabilityKind: candidate.capabilityKind,
                requiredBy: candidate.requiredBy,
                requestedCapabilityId: candidate.requestedCapabilityId ?? null,
                reason: candidate.reason
            })]);
    if (closureId === "dynamic-semantic-execution") {
        const bindings = records(interfaces.portBindings, "PORT_BINDINGS");
        const admitted = records(graph.admittedPlatformCapabilities, "ADMITTED_PLATFORM_CAPABILITIES");
        const dynamicCapabilityIds = new Set(admitted.filter((capability) => Array.isArray(capability.providesMechanics) && capability.providesMechanics.includes("authority-driven-transformation"))
            .map((capability) => capability.capabilityId));
        return bindings.some((binding) => binding.platformCapabilityId === "sda-declarative-value-port.v1") ||
            !bindings.some((binding) => dynamicCapabilityIds.has(binding.platformCapabilityId))
            ? [finding("MISSING_AUTHORITY_DRIVEN_TRANSFORMATION")] : [];
    }
    if (closureId === "domain-contract-admission") {
        if (interfaces.contractValidatorCapabilityId !== "sda-schema-contract-admission.v1")
            return [finding("MISSING_RUNTIME_SCHEMA_CONTRACT_BINDING")];
        const authorities = graph.contractAuthorities === null ? null : record(graph.contractAuthorities, "CONTRACT_AUTHORITIES");
        const contracts = authorities ? record(authorities.contracts, "CONTRACTS") : {};
        const missing = new Set(scenarios.flatMap((scenario) => {
            const input = record(record(scenario.input, "SCENARIO_INPUT").contract, "INPUT_CONTRACT");
            const outcome = record(record(scenario.outcome, "SCENARIO_OUTCOME").contract, "OUTCOME_CONTRACT");
            return [input.contractId, outcome.contractId];
        }).filter((contractId) => !Object.hasOwn(contracts, String(contractId))));
        return [...missing].map((contractId) => finding("MISSING_RUNTIME_SCHEMA_CONTRACT_BINDING", { contractId }));
    }
    return null;
}
export class ConsumerExecutionEmbodimentCompiler {
    compileV3(query, target, capabilityAuthority, providerProfiles) {
        const authorityGraph = record(query.authorityGraph, "AUTHORITY_GRAPH");
        const interfaceAuthority = record(authorityGraph.interfaceAuthority, "INTERFACE_AUTHORITY");
        const projectionBindings = records(interfaceAuthority.projectionBindings ?? [], "PROJECTION_BINDINGS");
        const bindingAuthorities = records(authorityGraph.projectionAuthorities ?? [], "PROJECTION_AUTHORITIES").map((authority) => {
            const authorityId = text(authority.id, "PROJECTION_AUTHORITY_ID");
            const binding = projectionBindings.find((candidate) => candidate.projectionId === authorityId);
            return Object.freeze({ ...authority, ...(binding ? { binding: Object.freeze({ ...binding }) } : {}) });
        });
        const compiled = new SemanticExecutionGraphCompiler().compile({
            capability: Object.freeze({
                capabilityId: text(query.capabilityId, "CAPABILITY_ID"),
                rootScenarioId: text(authorityGraph.rootScenarioId, "ROOT_SCENARIO_ID")
            }),
            scenarios: records(authorityGraph.scenarios, "SCENARIOS"),
            transitions: records(authorityGraph.transitions, "TRANSITIONS"),
            executionAuthorities: records(authorityGraph.executionAuthorities, "EXECUTION_AUTHORITIES"),
            interfaceAuthority: record(authorityGraph.interfaceAuthority, "INTERFACE_AUTHORITY"),
            ...(Array.isArray(authorityGraph.edgeGroups)
                ? { edgeGroups: authorityGraph.edgeGroups } : {}),
            ...(Array.isArray(authorityGraph.recurrenceAuthorities)
                ? { recurrenceAuthorities: authorityGraph.recurrenceAuthorities } : {}),
            ...(Array.isArray(authorityGraph.scenarioOutcomes)
                ? { scenarioOutcomes: authorityGraph.scenarioOutcomes } : {}),
            authorityDigest: digest(capabilityAuthority),
            sourceRefs: Object.freeze(["capability.authority.json", "semantic-graph.authority.json", "execution-authorities.authority.json", "interfaces.authority.json"])
        });
        const mechanics = record(query.mechanicResolution, "MECHANIC_RESOLUTION");
        const resolutions = records(mechanics.resolutions, "MECHANIC_RESOLUTIONS");
        const defaults = [...new Set(compiled.graph.requiredProviderSlots.map((slot) => slot.mechanicId))].map((mechanicId) => {
            const selected = resolutions.find((candidate) => candidate.requestedCapabilityId === mechanicId || candidate.capabilityId === mechanicId);
            const profileId = typeof selected?.capabilityId === "string" ? `${target}:${selected.capabilityId}` : `${target}:provider:${mechanicId}`;
            return Object.freeze({
                profileId,
                targetId: target,
                mechanicIds: Object.freeze([mechanicId]),
                implementationRef: typeof selected?.implementationRef === "string" ? selected.implementationRef : "graph-v1-compatibility-provider"
            });
        });
        const overlay = resolveRealizationOverlay(compiled.graph, target, providerProfiles ?? defaults);
        return createPlanV3(compiled.graph, overlay, compiled.sourceMap, (authorityGraph.contractAuthorities ?? {}), bindingAuthorities);
    }
    compile(query, target, capabilityAuthority) {
        const graph = record(query.authorityGraph, "AUTHORITY_GRAPH");
        const scenarios = records(graph.scenarios, "SCENARIOS");
        const transitions = records(graph.transitions, "TRANSITIONS");
        const executions = records(graph.executionAuthorities, "EXECUTION_AUTHORITIES");
        const interfaces = record(graph.interfaceAuthority, "INTERFACE_AUTHORITY");
        const portBindings = records(interfaces.portBindings, "PORT_BINDINGS");
        const projectionBindings = records(interfaces.projectionBindings, "PROJECTION_BINDINGS");
        const usesComposition = executions.some((authority) => records(authority.operations, "EXECUTION_OPERATIONS")
            .some((operation) => operation.kind === "invoke-scenario"));
        const mechanicBindings = new Map();
        const validatorCapabilityId = text(interfaces.contractValidatorCapabilityId, "CONTRACT_VALIDATOR_CAPABILITY_ID");
        const validatorResolution = resolution(query, "scenario-contract-admission", validatorCapabilityId);
        mechanicBindings.set("contract-admission", bindingFromResolution("contract-admission", "contract-admission", validatorResolution, Object.freeze({ contractAuthorities: graph.contractAuthorities ?? null })));
        const nodes = scenarios.map((sourceScenario) => {
            const scenario = normalizedScenario(sourceScenario);
            const scenarioId = text(scenario.scenarioId, "SCENARIO_ID");
            const event = record(scenario.event, "SCENARIO_EVENT");
            const authority = executions.find((candidate) => candidate.id === event.executionAuthorityId);
            if (!authority)
                throw new Error(`CONSUMER_EXECUTION_PLAN_MISSING_AUTHORITY: '${String(event.executionAuthorityId)}'.`);
            const operations = records(authority.operations, "EXECUTION_OPERATIONS").map((operation, index) => {
                if (operation.kind === "invoke-scenario") {
                    const scenarioNodeId = text(operation.scenarioId, "SCENARIO_NODE_ID");
                    if (!scenarios.some((candidate) => candidate.scenarioId === scenarioNodeId)) {
                        throw new Error(`CONSUMER_EXECUTION_PLAN_MISSING_SCENARIO: '${scenarioNodeId}'.`);
                    }
                    return Object.freeze({ operationId: `${scenarioId}.operation.${index + 1}`, kind: "invoke-scenario", scenarioNodeId });
                }
                if (operation.kind === "project-state") {
                    const projectionId = text(operation.projectionId, "OPERATION_PROJECTION_ID");
                    const binding = projectionBindings.find((candidate) => candidate.projectionId === projectionId);
                    if (!binding)
                        throw new Error(`CONSUMER_EXECUTION_PLAN_MISSING_PROJECTION: '${projectionId}'.`);
                    const capabilityId = text(binding.platformCapabilityId, "PROJECTION_CAPABILITY_ID");
                    const bindingId = `projection:${projectionId}`;
                    if (!mechanicBindings.has(bindingId)) {
                        mechanicBindings.set(bindingId, bindingFromResolution(bindingId, "state-projection", resolution(query, bindingId, capabilityId), record(binding.configuration ?? {}, "PROJECTION_CONFIGURATION")));
                    }
                    return Object.freeze({ operationId: `${scenarioId}.operation.${index + 1}`, kind: "project-state", mechanicBindingId: bindingId });
                }
                if (operation.kind !== "invoke-port")
                    throw new Error(`CONSUMER_EXECUTION_PLAN_UNSUPPORTED_OPERATION: '${String(operation.kind)}'.`);
                const portId = text(operation.portId, "PORT_ID");
                const binding = portBindings.find((candidate) => candidate.portId === portId);
                if (!binding)
                    throw new Error(`CONSUMER_EXECUTION_PLAN_MISSING_PORT: '${portId}'.`);
                const capabilityId = text(binding.platformCapabilityId, "PORT_CAPABILITY_ID");
                const bindingId = `port:${portId}`;
                if (!mechanicBindings.has(bindingId)) {
                    mechanicBindings.set(bindingId, bindingFromResolution(bindingId, "event-port", resolution(query, bindingId, capabilityId), record(binding.configuration ?? {}, "PORT_CONFIGURATION")));
                }
                return usesComposition
                    ? Object.freeze({ operationId: `${scenarioId}.operation.${index + 1}`, kind: "invoke-port", mechanicBindingId: bindingId })
                    : Object.freeze({ operationId: `${scenarioId}.operation.${index + 1}`, mechanicBindingId: bindingId });
            });
            const outgoing = transitions.filter((candidate) => record(candidate.from, "TRANSITION_FROM").scenarioId === scenarioId);
            if (outgoing.length > 1)
                throw new Error(`CONSUMER_EXECUTION_PLAN_AMBIGUOUS_TRANSITION: '${scenarioId}'.`);
            const sourceTransition = outgoing[0];
            let transition = null;
            if (sourceTransition) {
                const from = record(sourceTransition.from, "TRANSITION_FROM");
                const to = record(sourceTransition.to, "TRANSITION_TO");
                let mechanicBindingId = null;
                if (from.contractId !== to.contractId) {
                    const projectionId = text(sourceTransition.bindingAuthorityId, "PROJECTION_ID");
                    const binding = projectionBindings.find((candidate) => candidate.projectionId === projectionId);
                    if (!binding)
                        throw new Error(`CONSUMER_EXECUTION_PLAN_MISSING_PROJECTION: '${projectionId}'.`);
                    const capabilityId = text(binding.platformCapabilityId, "PROJECTION_CAPABILITY_ID");
                    mechanicBindingId = `projection:${projectionId}`;
                    if (!mechanicBindings.has(mechanicBindingId)) {
                        mechanicBindings.set(mechanicBindingId, bindingFromResolution(mechanicBindingId, "state-projection", resolution(query, mechanicBindingId, capabilityId), record(binding.configuration ?? {}, "PROJECTION_CONFIGURATION")));
                    }
                }
                transition = Object.freeze({
                    transitionId: text(sourceTransition.transitionId, "TRANSITION_ID"),
                    nextNodeId: text(to.scenarioId, "NEXT_SCENARIO_ID"),
                    mechanicBindingId
                });
            }
            return Object.freeze({ nodeId: scenarioId, scenario, operations: Object.freeze(operations), transition });
        });
        const requiredClosures = query.requiredClosures;
        if (!Array.isArray(requiredClosures) || requiredClosures.some((closureId) => typeof closureId !== "string" || closureId.length === 0)) {
            throw new Error("CONSUMER_EXECUTION_PLAN_REQUIRED_CLOSURES_MUST_BE_STRINGS");
        }
        const closures = requiredClosures.map((closureId) => {
            if (closureId === "expected-to-observed-execution") {
                return runtimeClosure(closureId, "expected-execution-trace.v1", { expectedTelemetry: query.expectedTelemetry });
            }
            if (closureId === "artifact-materialization") {
                const targets = portBindings.filter((binding) => binding.platformCapabilityId === "sda-filesystem-artifact-store.v1")
                    .map((binding) => record(binding.configuration ?? {}, "ARTIFACT_CONFIGURATION").targetPath)
                    .filter((value) => typeof value === "string" && value.length > 0);
                return targets.length === 0
                    ? compiledClosure(closureId, [finding("MISSING_DURABLE_ARTIFACT_STORE")])
                    : runtimeClosure(closureId, "artifact-binding-observation.v1", { targetPaths: targets });
            }
            if (closureId === "consumer-executable-origin") {
                const origin = record(query.executableOrigin, "EXECUTABLE_ORIGIN");
                return origin.disposition === "PROJECTED_ONLY"
                    ? runtimeClosure(closureId, "projected-origin-observation.v1", { requiredDisposition: "PURE_PROJECTION_CONFORMS" })
                    : compiledClosure(closureId, [finding("UNAUTHORIZED_CONSUMER_EXECUTABLE", {
                            files: origin.unauthorizedFiles
                        })]);
            }
            const findings = staticFindings(closureId, query);
            return compiledClosure(closureId, findings ?? [finding("PROJECTION_CLOSURE_INCOMPLETE", { closureId })]);
        });
        const mechanicResolution = record(query.mechanicResolution, "MECHANIC_RESOLUTION");
        const plan = Object.freeze({
            executionEmbodimentPlanType: usesComposition
                ? "consumer-execution-embodiment-plan.v2" : "consumer-execution-embodiment-plan.v1",
            target,
            capabilityId: text(query.capabilityId, "CAPABILITY_ID"),
            source: Object.freeze({
                queryType: "projected-consumer-conformance-query.v1",
                queryId: text(query.queryId, "QUERY_ID"),
                queryDigest: digest(query),
                capabilityAuthorityDigest: digest(capabilityAuthority),
                mechanicResolutionDigest: digest(mechanicResolution)
            }),
            rootNodeId: text(graph.rootScenarioId, "ROOT_SCENARIO_ID"),
            nodes: Object.freeze(nodes),
            ...(usesComposition ? {
                compositionPolicy: Object.freeze({
                    carrierMode: "previous-admitted-outcome",
                    contractAdmissionMode: "each-scenario-boundary",
                    lineageMode: "retain-root-and-parent-execution",
                    failureMode: "stop-at-first-non-success",
                    cycleMode: "reject-recursive-invocation"
                })
            } : {}),
            mechanicBindings: Object.freeze([...mechanicBindings.values()].sort((left, right) => left.bindingId.localeCompare(right.bindingId))),
            conformance: Object.freeze({
                queryId: text(query.queryId, "QUERY_ID"),
                platformMechanics: Object.freeze({ ...mechanicResolution }),
                executableOrigin: Object.freeze({ ...record(query.executableOrigin, "EXECUTABLE_ORIGIN") }),
                closures: Object.freeze(closures)
            }),
            requiredProviderCapabilityIds: Object.freeze([...new Set([...mechanicBindings.values()].map((binding) => binding.providerCapabilityId))].sort())
        });
        return plan;
    }
}
