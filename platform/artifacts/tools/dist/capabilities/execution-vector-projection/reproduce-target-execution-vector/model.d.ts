import type { SourceFact } from "../../../model/semantic-model.js";
import type { ProjectionPlan } from "../../../projection/model/projection-plan.js";
import type { StructuralProjectionProfile } from "../../../projection/model/projection-profile.js";
import type { TargetExecutionGraph } from "../../../projection/model/target-execution-graph.js";
export interface ReproduceTargetExecutionVectorInput {
    readonly targetGraph: TargetExecutionGraph;
    readonly profile: SourceFact<StructuralProjectionProfile>;
}
export type ReproduceTargetExecutionVectorEvidence = ProjectionPlan;
export declare function isReproduceTargetExecutionVectorInput(value: unknown): value is ReproduceTargetExecutionVectorInput;
export declare function isExecutionProjectionPlanEvidence(value: unknown): value is ProjectionPlan;
