import { sha256 } from "./canonical-json.js";
import { canonicalGraphDigest } from "./normalizer.js";
export function observedPathDigest(cells, edges) {
    return sha256({
        cells: [...cells].sort((left, right) => left.logicalOrder - right.logicalOrder).map((item) => ({ cellId: item.cellId, occurrenceId: item.occurrenceId, iterationId: item.iterationId ?? null, outcomeVariant: item.outcomeVariant, disposition: item.disposition })),
        edges: [...edges].sort((left, right) => left.logicalOrder - right.logicalOrder).map((item) => ({ edgeId: item.edgeId, iterationId: item.iterationId ?? null, admissionDisposition: item.admissionDisposition }))
    });
}
export function verifyObservedTopology(graph, cells, edges, effects = []) {
    const findings = [];
    const cellIds = new Set(graph.cells.map((cell) => cell.cellId));
    const edgeIds = new Set(graph.edges.map((edge) => edge.edgeId));
    const executionIds = new Set(cells.map((item) => item.cellExecutionId));
    for (const item of cells) {
        if (!cellIds.has(item.cellId))
            findings.push({ code: "UNEXPECTED_CELL_EXECUTED", subjectId: item.cellId, message: "Observed cell has no canonical graph address." });
        if (item.canonicalGraphDigest !== canonicalGraphDigest(graph))
            findings.push({ code: "CANONICAL_TOPOLOGY_DIVERGENCE", subjectId: item.cellExecutionId, message: "Cell testimony names different canonical graph bytes." });
        const cell = graph.cells.find((candidate) => candidate.cellId === item.cellId);
        if (cell?.execution.providerSlotId && !item.providerProfileId)
            findings.push({ code: "PROVIDER_TESTIMONY_GAP", subjectId: item.cellExecutionId, message: "Provider-bound cell omitted provider identity." });
    }
    for (const item of edges) {
        if (!edgeIds.has(item.edgeId))
            findings.push({ code: "UNEXPECTED_EDGE_TRAVERSED", subjectId: item.edgeId, message: "Observed edge has no canonical graph address." });
        const edge = graph.edges.find((candidate) => candidate.edgeId === item.edgeId);
        if (edge && (edge.to.cellId !== item.destinationCellId || edge.to.portId !== item.destinationPortId))
            findings.push({ code: "OBSERVED_TOPOLOGY_DIVERGENCE", subjectId: item.edgeId, message: "Observed destination differs from graph authority." });
    }
    for (const effect of effects) {
        if (!effect.cellExecutionId || !executionIds.has(effect.cellExecutionId))
            findings.push({ code: "UNDECLARED_PHYSICAL_EFFECT", subjectId: effect.effectId, message: "Effect has no graph-issued execution context." });
        else if (!effect.providerProfileId)
            findings.push({ code: "PROVIDER_TESTIMONY_GAP", subjectId: effect.effectId, message: "Effect has no provider testimony." });
    }
    findings.sort((left, right) => left.code.localeCompare(right.code) || left.subjectId.localeCompare(right.subjectId));
    return Object.freeze({
        conformanceType: "execution-topology-conformance.v1", graphId: graph.graphId, canonicalGraphDigest: canonicalGraphDigest(graph), observedPathDigest: observedPathDigest(cells, edges),
        disposition: findings.length === 0 ? "CONFORMING" : "NON_CONFORMING",
        plannedCellIds: Object.freeze([...cellIds].sort()), observedCellIds: Object.freeze([...new Set(cells.map((item) => item.cellId))].sort()),
        plannedEdgeIds: Object.freeze([...edgeIds].sort()), observedEdgeIds: Object.freeze([...new Set(edges.map((item) => item.edgeId))].sort()), findings: Object.freeze(findings)
    });
}
export function compareCanonicalRuns(runs) {
    if (runs.length === 0)
        return Object.freeze([{ code: "CROSS_APPLY_INCOMPLETE", subjectId: "cross-apply", message: "No target runs were supplied." }]);
    const canonical = new Set(runs.map((run) => run.canonicalGraphDigest));
    const paths = new Set(runs.map((run) => run.observedPathDigest));
    return Object.freeze([
        ...(canonical.size === 1 ? [] : [{ code: "CANONICAL_TOPOLOGY_DIVERGENCE", subjectId: "cross-apply", message: "Targets loaded different canonical graph bytes." }]),
        ...(paths.size === 1 ? [] : [{ code: "OBSERVED_TOPOLOGY_DIVERGENCE", subjectId: "cross-apply", message: "Targets selected different canonical paths." }])
    ]);
}
