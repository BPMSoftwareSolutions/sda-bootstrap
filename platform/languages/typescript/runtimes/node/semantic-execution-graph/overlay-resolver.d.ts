import type { ExecutionCell, ExecutionEdge, RealizationOverlay, SemanticExecutionGraph } from "./model.js";
export interface ProviderProfileProjection {
    readonly profileId: string;
    readonly profileDigest?: string;
    readonly targetId: string;
    readonly mechanicIds: readonly string[];
    readonly implementationRef: string;
    readonly physicalCells?: readonly ExecutionCell[];
    readonly physicalEdges?: readonly ExecutionEdge[];
}
export declare function resolveRealizationOverlay(graph: SemanticExecutionGraph, targetId: string, profiles: readonly ProviderProfileProjection[]): RealizationOverlay;
