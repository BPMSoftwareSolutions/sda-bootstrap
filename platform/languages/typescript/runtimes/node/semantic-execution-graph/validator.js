import { canonicalGraphDigest, normalizeGraph } from "./normalizer.js";
function finding(code, subjectId, message) {
    return Object.freeze({ code, subjectId, message });
}
function duplicates(values) {
    const seen = new Set();
    const found = new Set();
    for (const value of values)
        seen.has(value) ? found.add(value) : seen.add(value);
    return [...found].sort();
}
function undeclaredCycleEdges(graph) {
    const outgoing = new Map();
    for (const edge of graph.edges.filter((item) => item.kind !== "return" && item.kind !== "testimony" && item.kind !== "recurrence")) {
        const values = outgoing.get(edge.from.cellId) ?? [];
        values.push(edge);
        outgoing.set(edge.from.cellId, values);
    }
    function reaches(start, target) {
        const pending = [start];
        const visited = new Set();
        while (pending.length > 0) {
            const current = pending.shift();
            if (current === target)
                return true;
            if (visited.has(current))
                continue;
            visited.add(current);
            pending.push(...(outgoing.get(current) ?? []).map((edge) => edge.to.cellId));
        }
        return false;
    }
    return graph.edges.filter((edge) => edge.kind !== "recurrence" && edge.kind !== "return" && edge.kind !== "testimony" && reaches(edge.to.cellId, edge.from.cellId));
}
export class SemanticExecutionGraphValidator {
    validate(graph, overlay) {
        const findings = [];
        const cellById = new Map(graph.cells.map((cell) => [cell.cellId, cell]));
        const edgeById = new Map(graph.edges.map((edge) => [edge.edgeId, edge]));
        const groupById = new Map(graph.edgeGroups.map((group) => [group.groupId, group]));
        const recurrenceById = new Map(graph.recurrenceAuthorities.map((item) => [item.recurrenceAuthorityId, item]));
        for (const id of duplicates(graph.cells.map((cell) => cell.cellId)))
            findings.push(finding("DUPLICATE_CELL_ID", id, "Cell identity is not unique."));
        for (const id of duplicates(graph.edges.map((edge) => edge.edgeId)))
            findings.push(finding("DUPLICATE_EDGE_ID", id, "Edge identity is not unique."));
        for (const id of duplicates(graph.edgeGroups.map((group) => group.groupId)))
            findings.push(finding("DUPLICATE_GROUP_ID", id, "Edge-group identity is not unique."));
        for (const id of duplicates(graph.requiredProviderSlots.map((slot) => slot.slotId)))
            findings.push(finding("DUPLICATE_PROVIDER_SLOT_ID", id, "Provider-slot identity is not unique."));
        for (const id of duplicates(graph.recurrenceAuthorities.map((item) => item.recurrenceAuthorityId)))
            findings.push(finding("DUPLICATE_RECURRENCE_AUTHORITY_ID", id, "Recurrence authority identity is not unique."));
        if (!cellById.has(graph.rootCellId))
            findings.push(finding("MISSING_ROOT_CELL", graph.rootCellId, "The graph root does not resolve to a cell."));
        for (const cell of graph.cells) {
            if (cell.execution.protocolRef !== "cell-execution-protocol.v1")
                findings.push(finding("MISSING_CELL_PROTOCOL", cell.cellId, "Cell does not reference the universal protocol."));
            if (cell.sourcePointers.length === 0 || cell.sourceAuthorityDigests.length === 0)
                findings.push(finding("MISSING_SOURCE_LINEAGE", cell.cellId, "Cell source pointer and authority digest are required."));
            if (cell.parentCellId !== null && !cellById.has(cell.parentCellId))
                findings.push(finding("MISSING_PARENT_CELL", cell.cellId, `Parent '${cell.parentCellId}' does not exist.`));
            if (cell.altitude === "physical" && !cell.execution.primitiveProfileId)
                findings.push(finding("MISSING_PHYSICAL_PRIMITIVE_PROFILE", cell.cellId, "Physical cells require a primitive profile."));
            const outgoing = graph.edges.filter((edge) => edge.from.cellId === cell.cellId && edge.kind !== "return" && edge.kind !== "testimony");
            if (cell.terminal === true && outgoing.length > 0)
                findings.push(finding("TERMINAL_CELL_HAS_OUTGOING_EDGE", cell.cellId, "Terminal cells cannot continue executable topology."));
        }
        for (const edge of graph.edges) {
            const from = cellById.get(edge.from.cellId);
            const to = cellById.get(edge.to.cellId);
            if (!from || !to) {
                findings.push(finding("ORPHAN_EDGE", edge.edgeId, "One or both edge endpoints do not exist."));
                continue;
            }
            if (from.outcome.portId !== edge.from.portId)
                findings.push(finding("EDGE_SOURCE_PORT_MISMATCH", edge.edgeId, "Edge source is not the cell outcome port."));
            if (edge.kind !== "return" && to.input.portId !== edge.to.portId)
                findings.push(finding("EDGE_DESTINATION_PORT_MISMATCH", edge.edgeId, "Edge destination is not the cell input port."));
            if (edge.kind === "return" && to.outcome.portId !== edge.to.portId)
                findings.push(finding("RETURN_PORT_MISMATCH", edge.edgeId, "Return edge must target the parent outcome port."));
            if (from.outcome.contractId !== to.input.contractId && edge.kind !== "return" && !edge.bindingAuthorityId)
                findings.push(finding("EDGE_CONTRACT_MISMATCH", edge.edgeId, "Different endpoint contracts require binding authority."));
            if (edge.groupId && !groupById.has(edge.groupId))
                findings.push(finding("MISSING_EDGE_GROUP", edge.edgeId, `Group '${edge.groupId}' does not exist.`));
            // A route may only select an outcome the source cell actually declares,
            // otherwise a branch names a result that can never be produced.
            if (edge.selectsVariant && !(from.outcome.variants ?? []).includes(edge.selectsVariant)) {
                findings.push(finding("UNDECLARED_BRANCH_VARIANT", edge.edgeId, `Edge selects '${edge.selectsVariant}', which '${from.cellId}' does not declare.`));
            }
            if (edge.kind === "recurrence" && (!edge.recurrenceAuthorityId || !recurrenceById.has(edge.recurrenceAuthorityId)))
                findings.push(finding("UNDECLARED_RECURRENCE", edge.edgeId, "Recurrence edge has no admitted bounded authority."));
            if (edge.kind === "recurrence" && edge.recurrenceAuthorityId && recurrenceById.has(edge.recurrenceAuthorityId)) {
                const authority = recurrenceById.get(edge.recurrenceAuthorityId);
                const admittedVariants = authority.continuationVariants ?? [authority.continuationVariant];
                if (!edge.selectsVariant || !admittedVariants.includes(edge.selectsVariant)) {
                    findings.push(finding("RECURRENCE_CONTINUATION_VARIANT_MISMATCH", edge.edgeId, `Recurrence edge variant '${edge.selectsVariant ?? "<missing>"}' is not admitted by '${authority.recurrenceAuthorityId}'.`));
                }
            }
        }
        for (const authority of graph.recurrenceAuthorities) {
            if (!Number.isInteger(authority.maximumIterations) || authority.maximumIterations < 1) {
                findings.push(finding("INVALID_RECURRENCE_BOUND", authority.recurrenceAuthorityId, "Recurrence maximumIterations must be a positive integer."));
            }
            if (authority.budgetContractId && !authority.budgetValuePath) {
                findings.push(finding("RECURRENCE_BUDGET_VALUE_PATH_REQUIRED", authority.recurrenceAuthorityId, "An input-bound recurrence budget requires budgetValuePath."));
            }
            if (authority.budgetValuePath && !authority.budgetContractId) {
                findings.push(finding("RECURRENCE_BUDGET_CONTRACT_REQUIRED", authority.recurrenceAuthorityId, "budgetValuePath requires budgetContractId."));
            }
            const recurrenceEdges = graph.edges.filter((edge) => edge.kind === "recurrence" && edge.recurrenceAuthorityId === authority.recurrenceAuthorityId);
            const sourceVariants = new Set(recurrenceEdges.flatMap((edge) => cellById.get(edge.from.cellId)?.outcome.variants ?? []));
            if (!sourceVariants.has(authority.stopVariant)) {
                findings.push(finding("RECURRENCE_STOP_VARIANT_UNDECLARED", authority.recurrenceAuthorityId, `No recurrence source declares stop variant '${authority.stopVariant}'.`));
            }
            if (authority.cancellationPolicy === "route-cancelled") {
                for (const destinationId of new Set(recurrenceEdges.map((edge) => edge.to.cellId))) {
                    if (!graph.edges.some((edge) => edge.from.cellId === destinationId && edge.kind === "cancellation")) {
                        findings.push(finding("RECURRENCE_CANCELLATION_ROUTE_MISSING", destinationId, `Recurrence '${authority.recurrenceAuthorityId}' requires a cancellation edge at its iteration boundary.`));
                    }
                }
            }
        }
        for (const group of graph.edgeGroups) {
            for (const edgeId of group.edgeIds)
                if (!edgeById.has(edgeId))
                    findings.push(finding("MISSING_GROUP_EDGE", group.groupId, `Group edge '${edgeId}' does not exist.`));
            const members = group.edgeIds.flatMap((id) => edgeById.get(id) ? [edgeById.get(id)] : []);
            if (members.some((edge) => edge.groupId !== group.groupId || edge.kind !== group.kind))
                findings.push(finding("EDGE_GROUP_MEMBERSHIP_MISMATCH", group.groupId, "Group members must name the group and topology kind."));
            if (group.kind === "selection") {
                if (group.exhaustive !== true)
                    findings.push(finding("NON_EXHAUSTIVE_BRANCH_AUTHORITY", group.groupId, "Selection groups must be explicitly exhaustive."));
                if (group.exclusive !== true)
                    findings.push(finding("NON_EXCLUSIVE_BRANCH_AUTHORITY", group.groupId, "Selection groups must be explicitly exclusive."));
                const variants = members.flatMap((edge) => edge.selectsVariant ? [edge.selectsVariant] : []);
                for (const variant of duplicates(variants))
                    findings.push(finding("DUPLICATE_BRANCH_VARIANT", group.groupId, `Variant '${variant}' is selected more than once.`));
                if (group.defaultEdgeId && !group.edgeIds.includes(group.defaultEdgeId))
                    findings.push(finding("INVALID_DEFAULT_EDGE", group.groupId, "Default edge is not a group member."));
            }
            if (group.kind === "broadcast" && group.policy !== "all")
                findings.push(finding("INVALID_BROADCAST_POLICY", group.groupId, "Broadcast requires the all policy."));
            if (group.kind === "join") {
                const produced = new Set(members.flatMap((edge) => edge.joinSlotId ? [edge.joinSlotId] : []));
                for (const slotId of group.requiredSlotIds ?? [])
                    if (!produced.has(slotId))
                        findings.push(finding("JOIN_INPUT_UNSATISFIED", group.groupId, `Required join slot '${slotId}' has no producer.`));
            }
        }
        for (const edge of undeclaredCycleEdges(graph))
            findings.push(finding("UNDECLARED_RECURRENCE", edge.edgeId, "Cycle is reachable without traversing an admitted recurrence edge."));
        if (cellById.has(graph.rootCellId)) {
            const reached = new Set();
            const pending = [graph.rootCellId];
            while (pending.length > 0) {
                const current = pending.shift();
                if (reached.has(current))
                    continue;
                reached.add(current);
                pending.push(...graph.edges.filter((edge) => edge.from.cellId === current).map((edge) => edge.to.cellId));
                pending.push(...graph.decompositions.filter((item) => item.parentCellId === current).flatMap((item) => item.entryCellIds));
            }
            for (const cell of graph.cells)
                if (!reached.has(cell.cellId))
                    findings.push(finding("UNREACHABLE_CELL", cell.cellId, "Cell is not reachable from the graph root."));
        }
        for (const decomposition of graph.decompositions) {
            if (!cellById.has(decomposition.parentCellId))
                findings.push(finding("MISSING_DECOMPOSITION_PARENT", decomposition.parentCellId, "Decomposition parent does not exist."));
            for (const id of [...decomposition.entryCellIds, ...decomposition.exitCellIds])
                if (!cellById.has(id))
                    findings.push(finding("MISSING_DECOMPOSITION_CELL", id, "Decomposition entry or exit does not exist."));
            for (const id of decomposition.exitCellIds)
                if (!graph.edges.some((edge) => edge.kind === "return" && edge.from.cellId === id && edge.to.cellId === decomposition.parentCellId))
                    findings.push(finding("MISSING_RETURN_PATH", id, "Every decomposition exit requires an explicit return edge."));
        }
        for (const slot of graph.requiredProviderSlots) {
            const cell = cellById.get(slot.cellId);
            if (!cell || cell.execution.providerSlotId !== slot.slotId)
                findings.push(finding("PROVIDER_SLOT_CELL_MISMATCH", slot.slotId, "Provider slot must resolve to the declaring cell."));
            if (overlay) {
                const matches = overlay.providerBindings.filter((binding) => binding.slotId === slot.slotId && binding.cellId === slot.cellId && binding.mechanicId === slot.mechanicId);
                if (matches.length !== 1)
                    findings.push(finding("PROVIDER_BINDING_DIVERGENCE", slot.slotId, `Expected exactly one provider binding, observed ${matches.length}.`));
            }
        }
        if (overlay) {
            const digest = canonicalGraphDigest(graph);
            if (overlay.graphId !== graph.graphId || overlay.canonicalGraphDigest !== digest)
                findings.push(finding("CANONICAL_TOPOLOGY_DIVERGENCE", overlay.overlayId, "Overlay is not bound to these canonical graph bytes."));
            const canonicalIds = new Set([...graph.cells.map((cell) => cell.cellId), ...graph.edges.map((edge) => edge.edgeId)]);
            for (const id of [...overlay.physicalCells.map((cell) => cell.cellId), ...overlay.physicalEdges.map((edge) => edge.edgeId)])
                if (canonicalIds.has(id))
                    findings.push(finding("OVERLAY_SEMANTIC_MUTATION", id, "Overlay physical identities cannot replace canonical identities."));
        }
        const normalizedOnce = normalizeGraph(graph);
        const normalizedTwice = normalizeGraph(normalizedOnce);
        if (JSON.stringify(normalizedOnce) !== JSON.stringify(normalizedTwice))
            findings.push(finding("NON_DETERMINISTIC_GRAPH_NORMALIZATION", graph.graphId, "Graph normalization is not idempotent."));
        findings.sort((left, right) => left.code.localeCompare(right.code) || left.subjectId.localeCompare(right.subjectId));
        return Object.freeze({ disposition: findings.length === 0 ? "ADMITTED" : "REJECTED", findings: Object.freeze(findings) });
    }
}
