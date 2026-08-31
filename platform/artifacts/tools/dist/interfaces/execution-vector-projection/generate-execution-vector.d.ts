import type { CanonicalExecutionGraph } from "../../projection/model/canonical-execution-graph.js";
import type { ProjectionPlan } from "../../projection/model/projection-plan.js";
import type { ProjectionTarget, StructuralProjectionProfile } from "../../projection/model/projection-profile.js";
import type { TargetExecutionGraph } from "../../projection/model/target-execution-graph.js";
export interface ExecutionProjectionBuild {
    readonly canonical: CanonicalExecutionGraph;
    readonly targetGraph: TargetExecutionGraph;
    readonly profile: StructuralProjectionProfile;
    readonly plan: ProjectionPlan;
}
export declare function generateExecutionVector(repositoryRoot: string, target: ProjectionTarget): ExecutionProjectionBuild;
