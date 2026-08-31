import type { CanonicalExecutionStepKind, FailureDisposition } from "./canonical-execution-graph.js";
import type { ProjectionTarget } from "./projection-profile.js";
export interface TargetExecutionStep {
    readonly stepId: string;
    readonly sequence: number;
    readonly kind: CanonicalExecutionStepKind;
    readonly consumes: readonly string[];
    readonly produces: string;
    readonly onFailureDisposition?: FailureDisposition;
    readonly sourcePointer: string;
}
export interface TargetExecutionGraph {
    readonly graphType: "target-execution-graph.v1";
    readonly target: ProjectionTarget;
    readonly renderingMode: "generated-orchestrator" | "admitted-kernel-delegation";
    readonly asyncMechanics: string;
    readonly cancellationMechanics: string;
    readonly steps: readonly TargetExecutionStep[];
    readonly sourcePointers: readonly string[];
}
