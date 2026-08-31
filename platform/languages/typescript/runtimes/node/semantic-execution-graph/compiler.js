import { sha256 } from "./canonical-json.js";
import { normalizeGraph } from "./normalizer.js";
import { SemanticTransformationGraphCompiler } from "./transformation-compiler.js";
import { SemanticExecutionGraphValidator } from "./validator.js";
function object(value, label) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new Error(`GRAPH_COMPILER_INVALID_${label}`);
    return value;
}
function array(value, label) {
    if (!Array.isArray(value))
        throw new Error(`GRAPH_COMPILER_INVALID_${label}`);
    return value;
}
function text(value, label) {
    if (typeof value !== "string" || value.length === 0)
        throw new Error(`GRAPH_COMPILER_INVALID_${label}`);
    return value;
}
function optionalText(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
export class SemanticExecutionGraphCompiler {
    #transformationCompiler = new SemanticTransformationGraphCompiler();
    #validator = new SemanticExecutionGraphValidator();
    compile(sources) {
        const capabilityId = text(sources.capability.capabilityId, "CAPABILITY_ID");
        const rootScenarioId = text(sources.capability.rootScenarioId, "ROOT_SCENARIO_ID");
        const authorityDigest = sources.authorityDigest ?? sha256(sources);
        const cells = [];
        const edges = [];
        const edgeGroups = [];
        const decompositions = [];
        const recurrenceAuthorities = [];
        const requiredProviderSlots = [];
        const sourceMap = {};
        // `invoke-scenario` operations are resolved after every scenario cell exists,
        // because a parent may invoke a scenario declared later in the source order.
        const pendingInvocations = [];
        // Declared outcome variants per scenario. Without these a scenario cell has
        // one variant and no route can select by result, which is what kept
        // alternatives parked as ordered operations instead of topology.
        const declaredVariants = new Map((sources.scenarioOutcomes ?? []).map((declared) => [
            text(declared.scenarioId, "SCENARIO_OUTCOME_SCENARIO_ID"),
            array(declared.variants, "SCENARIO_OUTCOME_VARIANTS").map((value) => text(value, "SCENARIO_OUTCOME_VARIANT"))
        ]));
        const scenarioById = new Map(sources.scenarios.map((scenario) => [text(scenario.scenarioId, "SCENARIO_ID"), scenario]));
        const authorityByScenario = new Map(sources.executionAuthorities.map((authority) => [text(authority.owningScenarioId, "OWNING_SCENARIO_ID"), authority]));
        const bindings = array(sources.interfaceAuthority.portBindings, "PORT_BINDINGS").map((value) => object(value, "PORT_BINDING"));
        const bindingByPort = new Map(bindings.map((binding) => [text(binding.portId, "PORT_ID"), binding]));
        const transformationById = new Map((sources.semanticTransformations ?? []).map((item) => [text(item.id, "TRANSFORMATION_ID"), item]));
        const joinTargetScenarioIds = new Set(sources.transitions
            .filter((transition) => optionalText(transition.topologyKind) === "join")
            .map((transition) => text(object(transition.to, "TRANSITION_TO").scenarioId, "TO_SCENARIO_ID")));
        for (const [scenarioIndex, scenario] of sources.scenarios.entries()) {
            const scenarioId = text(scenario.scenarioId, "SCENARIO_ID");
            const input = object(scenario.input, "SCENARIO_INPUT");
            const inputContract = object(input.contract, "INPUT_CONTRACT");
            const event = object(scenario.event, "SCENARIO_EVENT");
            const outcome = object(scenario.outcome, "SCENARIO_OUTCOME");
            const outcomeContract = object(outcome.contract, "OUTCOME_CONTRACT");
            const authority = authorityByScenario.get(scenarioId);
            if (!authority)
                throw new Error(`GRAPH_COMPILER_MISSING_EXECUTION_AUTHORITY: '${scenarioId}'.`);
            const scenarioCellId = `cell:scenario:${scenarioId}`;
            const scenarioPointer = `scenarios#/${scenarioIndex}`;
            cells.push(Object.freeze({
                cellId: scenarioCellId,
                semanticAddress: `${capabilityId}/scenario/${scenarioId}`,
                altitude: "scenario",
                parentCellId: null,
                input: Object.freeze({
                    portId: `${scenarioCellId}:input`,
                    contractId: text(inputContract.contractId, "INPUT_CONTRACT_ID"),
                    ...(joinTargetScenarioIds.has(scenarioId) ? { cardinality: "named-product" } : {})
                }),
                execution: Object.freeze({
                    kind: "scenario",
                    authorityId: text(event.executionAuthorityId, "EXECUTION_AUTHORITY_ID"),
                    authorityDigest: sha256(authority),
                    protocolRef: "cell-execution-protocol.v1"
                }),
                outcome: Object.freeze({
                    portId: `${scenarioCellId}:outcome`,
                    contractId: text(outcomeContract.contractId, "OUTCOME_CONTRACT_ID"),
                    variants: Object.freeze(declaredVariants.get(scenarioId) ?? [outcome.terminal === true ? "TERMINAL" : "SUCCESS"])
                }),
                sourcePointers: Object.freeze([scenarioPointer]),
                sourceAuthorityDigests: Object.freeze([authorityDigest]),
                ...(outcome.terminal === true ? { terminal: true } : {})
            }));
            sourceMap[scenarioCellId] = Object.freeze([scenarioPointer]);
            const operations = array(authority.operations, "EXECUTION_OPERATIONS").map((value) => object(value, "EXECUTION_OPERATION"));
            const operationCellIds = [];
            for (const [operationIndex, operation] of operations.entries()) {
                const operationId = optionalText(operation.operationId) ?? `${scenarioId}.operation.${operationIndex + 1}`;
                const operationCellId = optionalText(operation.cellId) ?? `cell:mechanic:${operationId}`;
                operationCellIds.push(operationCellId);
                const operationPointer = `executionAuthorities/${scenarioId}/operations/${operationIndex}`;
                const kind = text(operation.kind, "OPERATION_KIND");
                const portId = optionalText(operation.portId);
                const binding = portId ? bindingByPort.get(portId) : undefined;
                const mechanicId = kind === "invoke-port" ? text(binding?.platformCapabilityId, "PLATFORM_CAPABILITY_ID") : kind;
                const providerSlotId = optionalText(operation.providerSlotId) ?? `slot:${operationCellId}`;
                const operationInputContract = optionalText(operation.inputContractId) ?? (operationIndex === 0
                    ? text(inputContract.contractId, "INPUT_CONTRACT_ID") : "semantic-value.v1");
                const operationOutcomeContract = optionalText(operation.outcomeContractId) ?? (operationIndex === operations.length - 1
                    ? text(outcomeContract.contractId, "OUTCOME_CONTRACT_ID") : "semantic-value.v1");
                const configuration = Object.freeze({ ...operation, ...(binding ? { binding } : {}) });
                cells.push(Object.freeze({
                    cellId: operationCellId,
                    semanticAddress: `${capabilityId}/scenario/${scenarioId}/operation/${operationId}`,
                    altitude: "mechanic",
                    parentCellId: scenarioCellId,
                    input: Object.freeze({ portId: `${operationCellId}:input`, contractId: operationInputContract }),
                    execution: Object.freeze({
                        kind: "mechanic",
                        authorityId: `operation:${mechanicId}`,
                        authorityDigest: sha256(operation),
                        protocolRef: "cell-execution-protocol.v1",
                        providerSlotId,
                        configuration
                    }),
                    outcome: Object.freeze({ portId: `${operationCellId}:outcome`, contractId: operationOutcomeContract, variants: Object.freeze(["SUCCESS", "FAILURE", "CANCELLED"]) }),
                    sourcePointers: Object.freeze([operationPointer]),
                    sourceAuthorityDigests: Object.freeze([authorityDigest])
                }));
                sourceMap[operationCellId] = Object.freeze([operationPointer]);
                requiredProviderSlots.push(Object.freeze({ slotId: providerSlotId, cellId: operationCellId, mechanicId, profileConstraints: Object.freeze(["profile-bound"]) }));
                if (kind === "invoke-scenario") {
                    pendingInvocations.push(Object.freeze({
                        operationCellId,
                        targetScenarioId: text(operation.scenarioId, "INVOKED_SCENARIO_ID"),
                        pointer: operationPointer
                    }));
                }
                const config = binding ? object(binding.configuration, "PORT_CONFIGURATION") : undefined;
                const declaredTransformationId = config ? optionalText(config.transformationId) : undefined;
                const declared = declaredTransformationId ? transformationById.get(declaredTransformationId) : undefined;
                // The workspace repository materializes a port binding by inlining the
                // resolved transformation expression, which drops `transformationId`.
                // Both shapes must compile, or a capability whose whole policy lives in
                // its transformation AST would project as one opaque operation cell.
                const inlineExpression = config && !declared && config.expression !== undefined
                    ? object(config.expression, "TRANSFORMATION_EXPRESSION") : undefined;
                const transformationId = declaredTransformationId ?? (inlineExpression && portId ? portId : undefined);
                const transformation = declared ?? (inlineExpression ? Object.freeze({ id: transformationId, expression: inlineExpression }) : undefined);
                if (transformation) {
                    const root = object(transformation.expression, "TRANSFORMATION_EXPRESSION");
                    // Scope cell identity to this operation: the same transformation
                    // authority is invoked from many operations, and each invocation is a
                    // distinct execution site rather than the same cell appearing twice.
                    const fragment = this.#transformationCompiler.compile(transformationId, root, operationCellId, sha256(transformation), 10_000, operationId);
                    cells.push(...fragment.cells);
                    edges.push(...fragment.edges);
                    edgeGroups.push(...fragment.edgeGroups);
                    recurrenceAuthorities.push(...fragment.recurrenceAuthorities);
                    requiredProviderSlots.push(...fragment.requiredProviderSlots);
                    const returnEdges = fragment.exitCellIds.map((exitCellId, index) => Object.freeze({
                        edgeId: `edge:return:${exitCellId}:${operationCellId}:${index}`,
                        kind: "return",
                        from: Object.freeze({ cellId: exitCellId, portId: `${exitCellId}:outcome` }),
                        to: Object.freeze({ cellId: operationCellId, portId: `${operationCellId}:outcome` }),
                        edgeContractId: operationOutcomeContract,
                        authorityDigest: sha256({ operationCellId, exitCellId }),
                        sourcePointers: Object.freeze([operationPointer])
                    }));
                    edges.push(...returnEdges);
                    decompositions.push(Object.freeze({
                        parentCellId: operationCellId,
                        entryCellIds: fragment.entryCellIds,
                        exitCellIds: fragment.exitCellIds,
                        returnBindingAuthorityId: `binding:return:${operationCellId}`
                    }));
                }
            }
            if (operationCellIds.length === 0)
                throw new Error(`GRAPH_COMPILER_EMPTY_EXECUTION_AUTHORITY: '${scenarioId}'.`);
            for (let index = 0; index < operationCellIds.length - 1; index += 1) {
                const fromCell = cells.find((cell) => cell.cellId === operationCellIds[index]);
                const toCell = cells.find((cell) => cell.cellId === operationCellIds[index + 1]);
                edges.push(this.edge(`edge:sequence:${scenarioId}:${index + 1}`, "sequence", fromCell, toCell, authorityDigest, `executionAuthorities/${scenarioId}`));
            }
            const lastCell = cells.find((cell) => cell.cellId === operationCellIds.at(-1));
            const scenarioCell = cells.find((cell) => cell.cellId === scenarioCellId);
            edges.push(Object.freeze({
                edgeId: `edge:return:${scenarioId}`,
                kind: "return",
                from: Object.freeze({ cellId: lastCell.cellId, portId: lastCell.outcome.portId }),
                to: Object.freeze({ cellId: scenarioCellId, portId: scenarioCell.outcome.portId }),
                edgeContractId: scenarioCell.outcome.contractId,
                authorityDigest,
                sourcePointers: Object.freeze([scenarioPointer])
            }));
            decompositions.push(Object.freeze({
                parentCellId: scenarioCellId,
                entryCellIds: Object.freeze([operationCellIds[0]]),
                exitCellIds: Object.freeze([operationCellIds.at(-1)]),
                returnBindingAuthorityId: `binding:return:${scenarioId}`
            }));
        }
        // Declared decomposition for nested scenario invocation. The parent operation
        // cell opens into the invoked scenario's cell and binds its outcome back, so
        // nested execution is addressable topology rather than an untyped call.
        for (const invocation of pendingInvocations) {
            const parentCell = cells.find((cell) => cell.cellId === invocation.operationCellId);
            const targetCell = cells.find((cell) => cell.cellId === `cell:scenario:${invocation.targetScenarioId}`);
            if (!parentCell || !targetCell) {
                throw new Error(`GRAPH_COMPILER_MISSING_INVOKED_SCENARIO: '${invocation.targetScenarioId}'.`);
            }
            const reachableScenarioIds = new Set();
            const pendingScenarioIds = [invocation.targetScenarioId];
            while (pendingScenarioIds.length > 0) {
                const scenarioId = pendingScenarioIds.shift();
                if (reachableScenarioIds.has(scenarioId))
                    continue;
                reachableScenarioIds.add(scenarioId);
                for (const transition of sources.transitions) {
                    const from = object(transition.from, "TRANSITION_FROM");
                    const to = object(transition.to, "TRANSITION_TO");
                    if (text(from.scenarioId, "FROM_SCENARIO_ID") === scenarioId)
                        pendingScenarioIds.push(text(to.scenarioId, "TO_SCENARIO_ID"));
                }
            }
            const exitCells = sources.scenarios
                .filter((scenario) => reachableScenarioIds.has(text(scenario.scenarioId, "SCENARIO_ID")) && object(scenario.outcome, "SCENARIO_OUTCOME").terminal === true)
                .map((scenario) => cells.find((cell) => cell.cellId === `cell:scenario:${text(scenario.scenarioId, "SCENARIO_ID")}`))
                .filter(Boolean);
            if (exitCells.length === 0)
                exitCells.push(targetCell);
            for (const exitCell of exitCells) {
                edges.push(Object.freeze({
                    edgeId: `edge:invoke-return:${invocation.operationCellId}:${exitCell.cellId}`,
                    kind: "return",
                    from: Object.freeze({ cellId: exitCell.cellId, portId: exitCell.outcome.portId }),
                    to: Object.freeze({ cellId: parentCell.cellId, portId: parentCell.outcome.portId }),
                    edgeContractId: parentCell.outcome.contractId,
                    authorityDigest: sha256({ parent: parentCell.cellId, target: exitCell.cellId }),
                    sourcePointers: Object.freeze([invocation.pointer]),
                    ...(exitCell.outcome.contractId !== parentCell.outcome.contractId &&
                        parentCell.outcome.contractId !== "semantic-value.v1"
                        ? { bindingAuthorityId: `binding:invoke-return:${invocation.operationCellId}` } : {})
                }));
            }
            decompositions.push(Object.freeze({
                parentCellId: parentCell.cellId,
                entryCellIds: Object.freeze([targetCell.cellId]),
                exitCellIds: Object.freeze(exitCells.map((cell) => cell.cellId)),
                returnBindingAuthorityId: `binding:invoke-return:${invocation.operationCellId}`
            }));
        }
        for (const [index, transition] of sources.transitions.entries()) {
            const from = object(transition.from, "TRANSITION_FROM");
            const to = object(transition.to, "TRANSITION_TO");
            const fromCell = cells.find((cell) => cell.cellId === `cell:scenario:${text(from.scenarioId, "FROM_SCENARIO_ID")}`);
            const toCell = cells.find((cell) => cell.cellId === `cell:scenario:${text(to.scenarioId, "TO_SCENARIO_ID")}`);
            if (!fromCell || !toCell)
                throw new Error(`GRAPH_COMPILER_MISSING_TRANSITION_ENDPOINT: '${String(transition.transitionId)}'.`);
            const topologyKind = (optionalText(transition.topologyKind) ?? "sequence");
            const groupId = optionalText(transition.edgeGroupId);
            edges.push(Object.freeze({
                edgeId: `edge:${text(transition.transitionId, "TRANSITION_ID")}`,
                kind: topologyKind,
                from: Object.freeze({ cellId: fromCell.cellId, portId: fromCell.outcome.portId }),
                to: Object.freeze({ cellId: toCell.cellId, portId: toCell.input.portId }),
                edgeContractId: text(to.contractId, "TO_CONTRACT_ID"),
                authorityDigest: sha256(transition),
                sourcePointers: Object.freeze([`transitions#/${index}`]),
                ...(optionalText(transition.selectsVariant) ? { selectsVariant: optionalText(transition.selectsVariant) } : {}),
                ...(optionalText(transition.bindingAuthorityId) ? { bindingAuthorityId: optionalText(transition.bindingAuthorityId) } : {}),
                ...(groupId ? { groupId } : {}),
                ...(optionalText(transition.joinSlotId) ? { joinSlotId: optionalText(transition.joinSlotId) } : {}),
                ...(optionalText(transition.recurrenceAuthorityId) ? { recurrenceAuthorityId: optionalText(transition.recurrenceAuthorityId) } : {})
            }));
        }
        // Scenario-altitude selection groups and bounded recurrence come from the
        // semantic graph authority. Transformation fragments contribute their own,
        // so both sources merge before admission.
        for (const declared of sources.edgeGroups ?? []) {
            edgeGroups.push(Object.freeze({ ...declared }));
        }
        for (const declared of sources.recurrenceAuthorities ?? []) {
            recurrenceAuthorities.push(Object.freeze({ ...declared }));
        }
        const graph = normalizeGraph(Object.freeze({
            graphType: "sda-semantic-execution-graph.v1",
            graphId: `graph:${capabilityId}`,
            graphVersion: "1.0.0",
            rootCellId: `cell:scenario:${rootScenarioId}`,
            authority: Object.freeze({ capabilityId, authorityDigest, sourceRefs: Object.freeze([...(sources.sourceRefs ?? ["capability.authority.json"])]) }),
            cells: Object.freeze(cells), edges: Object.freeze(edges), decompositions: Object.freeze(decompositions),
            edgeGroups: Object.freeze(edgeGroups), recurrenceAuthorities: Object.freeze(recurrenceAuthorities),
            requiredProviderSlots: Object.freeze(requiredProviderSlots)
        }));
        const admission = this.#validator.validate(graph);
        if (admission.disposition !== "ADMITTED")
            throw new Error(`SEMANTIC_EXECUTION_GRAPH_REJECTED: ${JSON.stringify(admission.findings)}`);
        return Object.freeze({ graph, sourceMap: Object.freeze(sourceMap) });
    }
    async execute(sources) {
        return this.compile(sources);
    }
    edge(edgeId, kind, from, to, authorityDigest, sourcePointer) {
        return Object.freeze({
            edgeId, kind,
            from: Object.freeze({ cellId: from.cellId, portId: from.outcome.portId }),
            to: Object.freeze({ cellId: to.cellId, portId: to.input.portId }),
            edgeContractId: to.input.contractId,
            authorityDigest,
            sourcePointers: Object.freeze([sourcePointer]),
            ...(from.outcome.contractId !== to.input.contractId ? { bindingAuthorityId: `binding:${edgeId}` } : {})
        });
    }
}
export class SemanticExecutionGraphCompilerObligation {
    evaluate(evidence) {
        return { kind: evidence?.graph?.graphType === "sda-semantic-execution-graph.v1" ? "SATISFIED" : "NOT_SATISFIED", evidence };
    }
}
