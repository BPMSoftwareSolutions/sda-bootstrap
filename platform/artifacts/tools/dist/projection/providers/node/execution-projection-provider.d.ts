import type { ProjectionPlan } from "../../model/projection-plan.js";
import type { StructuralProjectionProfile } from "../../model/projection-profile.js";
import type { TargetExecutionGraph } from "../../model/target-execution-graph.js";
import type { ExecutionProjectionProvider } from "../execution-projection-provider.js";
export declare class NodeExecutionProjectionProvider implements ExecutionProjectionProvider {
    readonly target: "node";
    render(graph: TargetExecutionGraph, profile: StructuralProjectionProfile): ProjectionPlan;
}
