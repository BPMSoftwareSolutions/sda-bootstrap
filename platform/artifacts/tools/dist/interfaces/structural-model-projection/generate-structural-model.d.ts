import type { ProjectionPlan } from "../../projection/model/projection-plan.js";
import type { ProjectionTarget, StructuralProjectionProfile } from "../../projection/model/projection-profile.js";
import type { CanonicalTypeGraph } from "../../projection/model/canonical-type-graph.js";
import type { TargetProjectionGraph } from "../../projection/model/target-projection-graph.js";
export interface StructuralProjectionBuild {
    readonly canonical: CanonicalTypeGraph;
    readonly targetGraph: TargetProjectionGraph;
    readonly profile: StructuralProjectionProfile;
    readonly plan: ProjectionPlan;
}
export declare function generateStructuralModel(repositoryRoot: string, target: ProjectionTarget, profileOverrides?: Partial<StructuralProjectionProfile>): StructuralProjectionBuild;
