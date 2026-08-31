import type { CanonicalExecutionGraph } from "../model/canonical-execution-graph.js";
import type { StructuralProjectionProfile } from "../model/projection-profile.js";
import type { TargetExecutionGraph } from "../model/target-execution-graph.js";
export declare class CanonicalExecutionGraphBuilder {
    build(value: unknown, sourcePointer?: string): CanonicalExecutionGraph;
}
export declare class TargetExecutionGraphBuilder {
    build(canonical: CanonicalExecutionGraph, profile: StructuralProjectionProfile): TargetExecutionGraph;
}
