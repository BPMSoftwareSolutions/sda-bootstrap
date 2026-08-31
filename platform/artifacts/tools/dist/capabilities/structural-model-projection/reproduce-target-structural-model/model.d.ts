import type { SourceFact } from "../../../model/semantic-model.js";
import type { StructuralProjectionProfile } from "../../../projection/model/projection-profile.js";
import type { ProjectionPlan } from "../../../projection/model/projection-plan.js";
import type { TargetProjectionGraph } from "../../../projection/model/target-projection-graph.js";
export interface ReproduceStructuralModelInput {
    readonly targetGraph: TargetProjectionGraph;
    readonly profile: SourceFact<StructuralProjectionProfile>;
}
export type ReproduceStructuralModelEvidence = ProjectionPlan;
export declare function isReproduceStructuralModelInput(value: unknown): value is ReproduceStructuralModelInput;
export declare function isReproduceStructuralModelEvidence(value: unknown): value is ReproduceStructuralModelEvidence;
