import type { CellExecutionTestimony, EdgeExecutionTestimony, GraphFinding, SemanticExecutionGraph } from "./model.js";
export interface ObservedEffect {
    readonly effectId: string;
    readonly cellExecutionId?: string;
    readonly providerProfileId?: string;
}
export interface ExecutionTopologyConformance {
    readonly conformanceType: "execution-topology-conformance.v1";
    readonly graphId: string;
    readonly canonicalGraphDigest: string;
    readonly observedPathDigest: string;
    readonly disposition: "CONFORMING" | "NON_CONFORMING";
    readonly plannedCellIds: readonly string[];
    readonly observedCellIds: readonly string[];
    readonly plannedEdgeIds: readonly string[];
    readonly observedEdgeIds: readonly string[];
    readonly findings: readonly GraphFinding[];
}
export declare function observedPathDigest(cells: readonly CellExecutionTestimony[], edges: readonly EdgeExecutionTestimony[]): string;
export declare function verifyObservedTopology(graph: SemanticExecutionGraph, cells: readonly CellExecutionTestimony[], edges: readonly EdgeExecutionTestimony[], effects?: readonly ObservedEffect[]): ExecutionTopologyConformance;
export declare function compareCanonicalRuns(runs: readonly {
    targetId: string;
    canonicalGraphDigest: string;
    observedPathDigest: string;
}[]): readonly GraphFinding[];
