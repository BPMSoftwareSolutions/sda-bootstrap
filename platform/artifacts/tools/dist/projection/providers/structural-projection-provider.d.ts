import type { ProjectionPlan } from "../model/projection-plan.js";
import type { ProjectionTarget, StructuralProjectionProfile } from "../model/projection-profile.js";
import type { TargetProjectionGraph } from "../model/target-projection-graph.js";
export interface StructuralProjectionProvider {
    readonly target: ProjectionTarget;
    render(graph: TargetProjectionGraph, profile: StructuralProjectionProfile): ProjectionPlan;
}
