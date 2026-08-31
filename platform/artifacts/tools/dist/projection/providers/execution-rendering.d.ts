import type { ProjectionPlan } from "../model/projection-plan.js";
import type { ProjectionTarget, StructuralProjectionProfile } from "../model/projection-profile.js";
import type { TargetExecutionGraph } from "../model/target-execution-graph.js";
export declare function renderExecutionProjection(target: ProjectionTarget, graph: TargetExecutionGraph, profile: StructuralProjectionProfile): ProjectionPlan;
