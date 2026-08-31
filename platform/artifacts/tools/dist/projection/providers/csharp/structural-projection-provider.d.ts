import type { ProjectionPlan } from "../../model/projection-plan.js";
import type { StructuralProjectionProfile } from "../../model/projection-profile.js";
import type { TargetProjectionGraph } from "../../model/target-projection-graph.js";
import type { StructuralProjectionProvider } from "../structural-projection-provider.js";
export declare class CSharpStructuralProjectionProvider implements StructuralProjectionProvider {
    readonly target: "csharp";
    render(graph: TargetProjectionGraph, profile: StructuralProjectionProfile): ProjectionPlan;
}
