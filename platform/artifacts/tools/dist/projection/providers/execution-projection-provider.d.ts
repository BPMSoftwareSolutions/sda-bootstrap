import type { ProjectionPlan } from "../model/projection-plan.js";
import type { StructuralProjectionProfile, ProjectionTarget } from "../model/projection-profile.js";
import type { TargetExecutionGraph } from "../model/target-execution-graph.js";
export interface ExecutionProjectionProvider {
    readonly target: ProjectionTarget;
    render(graph: TargetExecutionGraph, profile: StructuralProjectionProfile): ProjectionPlan;
}
