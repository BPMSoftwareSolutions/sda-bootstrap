import { sha256 } from "./canonical-json.js";
import { canonicalGraphDigest, realizedGraphDigest } from "./normalizer.js";
import { observedPathDigest } from "./topology-verifier.js";
import { SemanticExecutionGraphValidator } from "./validator.js";
function providerOutcome(value, cell) {
    if (value !== null && typeof value === "object" && !Array.isArray(value) && Object.hasOwn(value, "outcomeValue")) {
        const source = value;
        const outcomeValue = source.outcomeValue;
        return Object.freeze({
            value: outcomeValue,
            variant: source.outcomeVariant ?? inferVariant(outcomeValue, cell),
            disposition: source.disposition ?? "completed"
        });
    }
    return Object.freeze({ value: value, variant: inferVariant(value, cell), disposition: "completed" });
}
function inferVariant(value, cell) {
    if (typeof value === "boolean")
        return value ? "TRUE" : "FALSE";
    if (typeof value === "string" && (cell.outcome.variants ?? []).includes(value))
        return value;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        for (const key of ["outcomeVariant", "variant", "route", "disposition", "status", "kind"]) {
            const candidate = value[key];
            if (typeof candidate === "string")
                return candidate;
        }
    }
    return cell.outcome.variants?.length === 1 ? cell.outcome.variants[0] : "SUCCESS";
}
function valueAtPath(value, declaredPath) {
    const segments = declaredPath.startsWith("/")
        ? declaredPath.slice(1).split("/").map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
        : declaredPath.split(".");
    let current = value;
    for (const segment of segments.filter((item) => item.length > 0)) {
        if (current === null || typeof current !== "object")
            return undefined;
        current = Array.isArray(current) ? current[Number(segment)] : current[segment];
    }
    return current;
}
export class GraphTokenScheduler {
    #graph;
    #overlay;
    #options;
    #cellById;
    #outgoing;
    #bindingBySlot;
    constructor(graph, overlay, options) {
        const admission = new SemanticExecutionGraphValidator().validate(graph, overlay);
        if (admission.disposition !== "ADMITTED")
            throw new Error(`GRAPH_SCHEDULER_ADMISSION_REJECTED: ${JSON.stringify(admission.findings)}`);
        this.#graph = graph;
        this.#overlay = overlay;
        this.#options = options;
        this.#cellById = new Map(graph.cells.map((cell) => [cell.cellId, cell]));
        const outgoing = new Map();
        for (const edge of graph.edges) {
            const values = outgoing.get(edge.from.cellId) ?? [];
            values.push(edge);
            outgoing.set(edge.from.cellId, values);
        }
        for (const values of outgoing.values())
            values.sort((left, right) => left.edgeId.localeCompare(right.edgeId));
        this.#outgoing = outgoing;
        this.#bindingBySlot = new Map(overlay.providerBindings.map((binding) => [binding.slotId, binding]));
    }
    async execute(input) {
        const canonicalDigest = canonicalGraphDigest(this.#graph);
        const realizedDigest = realizedGraphDigest(this.#graph, this.#overlay);
        const rootExecutionId = this.#options.rootExecutionId ?? `execution:${this.#graph.graphId}`;
        const queue = [{ cellId: this.#graph.rootCellId, input, parentCellExecutionId: null }];
        const cellTestimony = [];
        const edgeTestimony = [];
        const occurrenceByCell = new Map();
        const recurrenceCount = new Map();
        const recurrenceLimit = new Map();
        for (const authority of this.#graph.recurrenceAuthorities) {
            let limit = authority.maximumIterations;
            if (authority.budgetContractId && authority.budgetValuePath) {
                if (!this.admit(authority.budgetContractId, input, "input", this.#graph.rootCellId)) {
                    throw new Error(`RECURRENCE_BUDGET_CONTRACT_REJECTED: '${authority.recurrenceAuthorityId}'.`);
                }
                const declared = valueAtPath(input, authority.budgetValuePath);
                if (!Number.isInteger(declared) || Number(declared) < 1) {
                    throw new Error(`RECURRENCE_BUDGET_VALUE_REJECTED: '${authority.recurrenceAuthorityId}' at '${authority.budgetValuePath}'.`);
                }
                limit = Math.min(limit, Number(declared));
            }
            recurrenceLimit.set(authority.recurrenceAuthorityId, limit);
        }
        const joinBuffers = new Map();
        const completedFirstJoins = new Set();
        let logicalOrder = 0;
        let final = null;
        while (queue.length > 0) {
            const token = queue.shift();
            const cell = this.#cellById.get(token.cellId);
            if (!cell)
                throw new Error(`UNEXPECTED_CELL_EXECUTED: '${token.cellId}'.`);
            const recurrenceAuthority = token.incomingEdge?.kind === "recurrence"
                ? this.#graph.recurrenceAuthorities.find((item) => item.recurrenceAuthorityId === token.incomingEdge?.recurrenceAuthorityId)
                : undefined;
            const cancellationRequested = !token.cancellationRouted && this.#options.cancelled?.() === true;
            if (cancellationRequested && (!recurrenceAuthority || recurrenceAuthority.cancellationPolicy === "immediate")) {
                return this.result("cancelled", final?.value ?? token.input, "CANCELLED", cellTestimony, edgeTestimony);
            }
            const routeCancellation = cancellationRequested && recurrenceAuthority?.cancellationPolicy === "route-cancelled";
            const completeThenCancel = cancellationRequested && recurrenceAuthority?.cancellationPolicy === "complete-current";
            const occurrence = (occurrenceByCell.get(cell.cellId) ?? 0) + 1;
            occurrenceByCell.set(cell.cellId, occurrence);
            const cellExecutionId = token.resumeCellExecutionId ?? `${rootExecutionId}:${cell.cellId}:${occurrence}`;
            const decomposition = this.#graph.decompositions.find((item) => item.parentCellId === cell.cellId);
            if (decomposition && !token.resumeCellExecutionId && !routeCancellation) {
                if (!this.admit(cell.input.contractId, token.input, "input", cell.cellId)) {
                    final = { value: token.input, variant: "INPUT_REJECTED", disposition: "rejected" };
                    await this.complete(cell, cellExecutionId, token, final, [], canonicalDigest, realizedDigest, cellTestimony, logicalOrder++);
                    continue;
                }
                for (const entryCellId of [...decomposition.entryCellIds].sort())
                    queue.push({
                        cellId: entryCellId,
                        input: token.input,
                        parentCellExecutionId: cellExecutionId,
                        ...(token.iterationId ? { iterationId: token.iterationId } : {}),
                        returnIterationIds: [...(token.returnIterationIds ?? []), token.iterationId],
                        decompositionInputs: [...(token.decompositionInputs ?? []), token.input]
                    });
                continue;
            }
            let completed;
            if (routeCancellation)
                completed = Object.freeze({ value: token.input, variant: "CANCELLED", disposition: "cancelled" });
            else if (token.resumeCellExecutionId && cell.execution.authorityId === "operation:sda-authority-transformation-port.v1") {
                const enteringInput = token.resumeInput ?? token.input;
                completed = await this.executeCell(cell, cellExecutionId, rootExecutionId, { ...token, input: enteringInput });
            }
            else if (token.resumeCellExecutionId)
                completed = Object.freeze({ value: token.input, variant: inferVariant(token.input, cell), disposition: "completed" });
            else if (!this.admit(cell.input.contractId, token.input, "input", cell.cellId))
                completed = Object.freeze({ value: token.input, variant: "INPUT_REJECTED", disposition: "rejected" });
            else
                completed = await this.executeCell(cell, cellExecutionId, rootExecutionId, token);
            if (!this.admit(cell.outcome.contractId, completed.value, "outcome", cell.cellId) && completed.disposition === "completed")
                completed = Object.freeze({ value: completed.value, variant: "OUTCOME_REJECTED", disposition: "rejected" });
            const selected = this.selectEdges(cell, completed, recurrenceCount, recurrenceLimit);
            await this.complete(cell, cellExecutionId, token, completed, selected, canonicalDigest, realizedDigest, cellTestimony, logicalOrder++);
            if (routeCancellation && selected.length === 0) {
                throw new Error(`RECURRENCE_CANCELLATION_ROUTE_MISSING: '${recurrenceAuthority.recurrenceAuthorityId}' from '${cell.cellId}'.`);
            }
            if (completeThenCancel)
                return this.result("cancelled", completed.value, "CANCELLED", cellTestimony, edgeTestimony);
            if (selected.length === 0) {
                final = completed;
                continue;
            }
            for (const edge of selected) {
                const target = this.#cellById.get(edge.to.cellId);
                let edgeInput = completed.value;
                if (edge.bindingAuthorityId) {
                    if (!this.#options.projectBinding)
                        throw new Error(`UNDECLARED_EDGE_BINDING_MECHANIC: '${edge.bindingAuthorityId}'.`);
                    edgeInput = await this.#options.projectBinding(edge.bindingAuthorityId, completed.value, {
                        edge,
                        sourceCell: cell,
                        targetCell: target,
                        rootExecutionId,
                        sourceCellExecutionId: cellExecutionId
                    });
                }
                let admissionDisposition = "admitted";
                if (edge.kind === "join") {
                    const group = this.#graph.edgeGroups.find((item) => item.groupId === edge.groupId);
                    const bufferKey = `${edge.groupId}:${edge.to.cellId}:${token.iterationId ?? rootExecutionId}`;
                    if (group.policy === "first-admitted" && completedFirstJoins.has(bufferKey)) {
                        admissionDisposition = "cancelled";
                    }
                    const buffer = joinBuffers.get(bufferKey) ?? new Map();
                    if (admissionDisposition !== "cancelled") {
                        buffer.set(edge.joinSlotId, edgeInput);
                        joinBuffers.set(bufferKey, buffer);
                        const ready = group.policy === "first-admitted" || (group.requiredSlotIds ?? []).every((slotId) => buffer.has(slotId));
                        if (!ready)
                            admissionDisposition = "buffered";
                        else {
                            edgeInput = Object.fromEntries([...buffer.entries()].sort(([left], [right]) => left.localeCompare(right)));
                            joinBuffers.delete(bufferKey);
                            if (group.policy === "first-admitted")
                                completedFirstJoins.add(bufferKey);
                        }
                    }
                }
                const iterationId = edge.kind === "recurrence" ? `iteration:${edge.recurrenceAuthorityId}:${recurrenceCount.get(edge.recurrenceAuthorityId)}` : token.iterationId;
                const returnIterationIds = token.returnIterationIds ?? [];
                const destinationIterationId = edge.kind === "return" ? returnIterationIds.at(-1) : iterationId;
                const destinationReturnIterationIds = edge.kind === "return" ? returnIterationIds.slice(0, -1) : returnIterationIds;
                const decompositionInputs = token.decompositionInputs ?? [];
                const destinationDecompositionInputs = edge.kind === "return" ? decompositionInputs.slice(0, -1) : decompositionInputs;
                edgeTestimony.push(Object.freeze({
                    testimonyType: "edge-execution-testimony.v1", graphId: this.#graph.graphId, canonicalGraphDigest: canonicalDigest,
                    edgeId: edge.edgeId, edgeAuthorityDigest: edge.authorityDigest, sourceCellExecutionId: cellExecutionId,
                    sourceOutcomeDigest: sha256(completed.value), ...(edge.bindingAuthorityId ? { bindingAuthorityId: edge.bindingAuthorityId, bindingResultDigest: sha256(edgeInput) } : {}),
                    destinationCellId: edge.to.cellId, destinationPortId: edge.to.portId, ...(edge.groupId ? { groupId: edge.groupId } : {}),
                    ...(iterationId ? { iterationId } : {}), admissionDisposition, logicalOrder: logicalOrder++
                }));
                if (admissionDisposition !== "admitted")
                    continue;
                queue.push({
                    cellId: target.cellId, input: edgeInput, parentCellExecutionId: token.parentCellExecutionId,
                    incomingEdge: edge, ...(edge.kind === "return" ? { resumeCellExecutionId: token.parentCellExecutionId ?? `${rootExecutionId}:${target.cellId}:1` } : {}),
                    ...(edge.kind === "return" && decompositionInputs.length > 0 ? { resumeInput: decompositionInputs.at(-1) } : {}),
                    ...(destinationIterationId ? { iterationId: destinationIterationId } : {}),
                    ...(destinationReturnIterationIds.length > 0 ? { returnIterationIds: destinationReturnIterationIds } : {}),
                    ...(destinationDecompositionInputs.length > 0 ? { decompositionInputs: destinationDecompositionInputs } : {}),
                    ...(edge.kind === "cancellation" ? { cancellationRouted: true } : {})
                });
            }
        }
        if (!final) {
            const pendingJoins = [...joinBuffers.entries()].map(([key, buffer]) => ({ key, receivedSlotIds: [...buffer.keys()].sort() }));
            throw new Error(`GRAPH_SCHEDULER_NO_TERMINAL_OUTCOME: ${JSON.stringify({ pendingJoins })}`);
        }
        return this.result(final.disposition, final.value, final.variant, cellTestimony, edgeTestimony);
    }
    admit(contractId, value, direction, cellId) {
        return this.#options.admitContract?.(contractId, value, direction, cellId) ?? true;
    }
    async executeCell(cell, cellExecutionId, rootExecutionId, token) {
        const binding = cell.execution.providerSlotId ? this.#bindingBySlot.get(cell.execution.providerSlotId) : undefined;
        const provider = binding ? this.#options.providers[binding.providerProfileId] : undefined;
        if (cell.execution.providerSlotId && (!binding || !provider))
            throw new Error(`PROVIDER_BINDING_DIVERGENCE: '${cell.execution.providerSlotId}'.`);
        if (!provider && cell.execution.kind !== "junction")
            throw new Error(`UNDECLARED_EXECUTION_MECHANIC: '${cell.cellId}'.`);
        const context = Object.freeze({
            graphId: this.#graph.graphId, cellId: cell.cellId, cellExecutionId, rootExecutionId,
            authorityId: cell.execution.authorityId,
            ...(token.decompositionInputs?.length > 0 ? { decompositionInput: token.decompositionInputs.at(-1) } : {}),
            ...(binding ? { providerProfileId: binding.providerProfileId } : {}), ...(token.iterationId ? { iterationId: token.iterationId } : {}),
            ...(cell.execution.configuration ? { configuration: cell.execution.configuration } : {}),
            invokePhysicalEffect: async (primitiveProfileId, effectInput, effect) => {
                if (cell.altitude !== "physical" || cell.execution.primitiveProfileId !== primitiveProfileId || !binding)
                    throw new Error(`UNDECLARED_PHYSICAL_EFFECT: '${primitiveProfileId}' from '${cell.cellId}'.`);
                const result = await effect();
                this.#options.effectSink?.({ effectId: `${cellExecutionId}:${primitiveProfileId}`, primitiveProfileId, cellExecutionId, providerProfileId: binding.providerProfileId, inputDigest: sha256(effectInput), outcomeDigest: sha256(result) });
                return result;
            }
        });
        if (!provider && cell.execution.kind === "junction" && cell.execution.authorityId === "junction:boolean-selection.v1")
            return Object.freeze({ value: token.input, variant: Boolean(token.input) ? "TRUE" : "FALSE", disposition: "completed" });
        if (!provider)
            return providerOutcome(token.input, cell);
        try {
            return providerOutcome(await provider(token.input, context), cell);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return Object.freeze({ value: { code: "CELL_EXECUTION_FAILED", message }, variant: "FAILURE", disposition: "failed" });
        }
    }
    selectEdges(cell, completed, recurrenceCount, recurrenceLimit) {
        const all = this.#outgoing.get(cell.cellId) ?? [];
        let candidates = all.filter((edge) => {
            if (completed.disposition === "failed" || completed.disposition === "rejected")
                return edge.kind === "failure" || (edge.kind === "selection" && edge.selectsVariant === completed.variant);
            if (completed.disposition === "cancelled")
                return edge.kind === "cancellation";
            return edge.kind !== "failure" && edge.kind !== "cancellation";
        });
        const selections = candidates.filter((edge) => edge.kind === "selection");
        if (selections.length > 0) {
            const matched = selections.filter((edge) => edge.selectsVariant === completed.variant);
            const group = this.#graph.edgeGroups.find((item) => selections.some((edge) => edge.groupId === item.groupId));
            const fallback = group?.defaultEdgeId ? selections.find((edge) => edge.edgeId === group.defaultEdgeId) : undefined;
            candidates = matched.length > 0 ? matched : fallback ? [fallback] : candidates.filter((edge) => edge.kind !== "selection");
        }
        const recurrence = candidates.filter((edge) => edge.kind === "recurrence" && edge.selectsVariant === completed.variant);
        for (const edge of recurrence) {
            const authority = this.#graph.recurrenceAuthorities.find((item) => item.recurrenceAuthorityId === edge.recurrenceAuthorityId);
            const count = (recurrenceCount.get(authority.recurrenceAuthorityId) ?? 0) + 1;
            if (count > (recurrenceLimit.get(authority.recurrenceAuthorityId) ?? authority.maximumIterations)) {
                throw new Error(`RECURRENCE_BOUND_EXCEEDED: '${authority.recurrenceAuthorityId}'.`);
            }
            recurrenceCount.set(authority.recurrenceAuthorityId, count);
        }
        if (recurrence.length > 0)
            return Object.freeze([...recurrence].sort((left, right) => left.edgeId.localeCompare(right.edgeId)));
        return Object.freeze(candidates.filter((edge) => edge.kind !== "recurrence" || edge.selectsVariant === completed.variant).sort((left, right) => left.edgeId.localeCompare(right.edgeId)));
    }
    async complete(cell, cellExecutionId, token, completed, selected, canonicalDigest, realizedDigest, sink, logicalOrder) {
        const binding = cell.execution.providerSlotId ? this.#bindingBySlot.get(cell.execution.providerSlotId) : undefined;
        sink.push(Object.freeze({
            testimonyType: "cell-execution-testimony.v1", graphId: this.#graph.graphId, canonicalGraphDigest: canonicalDigest, realizedGraphDigest: realizedDigest,
            cellId: cell.cellId, cellAltitude: cell.altitude, cellExecutionId, rootExecutionId: this.#options.rootExecutionId ?? `execution:${this.#graph.graphId}`,
            parentCellExecutionId: token.parentCellExecutionId, ...(token.iterationId ? { iterationId: token.iterationId } : {}),
            occurrenceId: cellExecutionId, inputContractId: cell.input.contractId, inputDigest: sha256(token.input), executionAuthorityId: cell.execution.authorityId,
            authorityDigest: cell.execution.authorityDigest, ...(binding ? { providerProfileId: binding.providerProfileId, providerProfileDigest: binding.providerProfileDigest } : {}),
            outcomeContractId: cell.outcome.contractId, outcomeDigest: sha256(completed.value), outcomeVariant: completed.variant,
            disposition: completed.disposition, selectedEdgeIds: Object.freeze(selected.map((edge) => edge.edgeId)), logicalOrder
        }));
    }
    result(disposition, outcome, outcomeVariant, cellTestimony, edgeTestimony) {
        return Object.freeze({ disposition, outcome, outcomeVariant, cellTestimony: Object.freeze([...cellTestimony]), edgeTestimony: Object.freeze([...edgeTestimony]), observedPathDigest: observedPathDigest(cellTestimony, edgeTestimony) });
    }
}
