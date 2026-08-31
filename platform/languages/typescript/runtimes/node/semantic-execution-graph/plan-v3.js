import { canonicalGraphDigest, realizedGraphDigest } from "./normalizer.js";
import { SemanticExecutionGraphValidator } from "./validator.js";
export function createPlanV3(graph, overlay, sourceMap, contractCatalog = {}, bindingAuthorities = []) {
    const admission = new SemanticExecutionGraphValidator().validate(graph, overlay);
    if (admission.disposition !== "ADMITTED")
        throw new Error(`PLAN_V3_GRAPH_REJECTED: ${JSON.stringify(admission.findings)}`);
    return Object.freeze({
        executionEmbodimentPlanType: "consumer-execution-embodiment-plan.v3",
        target: overlay.targetId,
        capabilityId: graph.authority.capabilityId,
        canonicalGraph: graph,
        canonicalGraphDigest: canonicalGraphDigest(graph),
        realizationOverlay: overlay,
        realizedGraphDigest: realizedGraphDigest(graph, overlay),
        sourceMap,
        contractCatalog,
        bindingAuthorities: Object.freeze([...bindingAuthorities]),
        cellProtocolVersion: "cell-execution-protocol.v1",
        conformanceClosures: Object.freeze(["graph-admission", "provider-slot-coverage", "planned-observed-topology", "canonical-path-parity", "effect-lineage"]),
        expectedCanonicalTopology: {
            rootCellId: graph.rootCellId,
            cellIds: [...graph.cells.map((cell) => cell.cellId)].sort(),
            edgeIds: [...graph.edges.map((edge) => edge.edgeId)].sort()
        },
        executionPolicy: Object.freeze({ scheduler: "graph-token-scheduler.v1", logicalOrdering: "deterministic", undeclaredControlFlow: "reject" }),
        effectPolicy: Object.freeze({ graphIssuedContextRequired: true, providerTestimonyRequired: true })
    });
}
