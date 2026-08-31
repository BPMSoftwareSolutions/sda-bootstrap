import { type ReproduceStructuralModelEvidence } from "../../capabilities/structural-model-projection/reproduce-target-structural-model/model.js";
import { type DetermineShapeEquivalenceEvidence } from "../../capabilities/structural-model-projection/determine-projected-shape-equivalence/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
import type { ProjectionTarget } from "../../projection/model/projection-profile.js";
import { type DeriveCanonicalTypeGraphEvidence } from "../../capabilities/structural-model-projection/derive-canonical-type-graph/model.js";
import { type DeriveTargetProjectionGraphEvidence } from "../../capabilities/structural-model-projection/derive-target-projection-graph/model.js";
export interface StructuralModelProjectionRun {
    readonly canonical: ScenarioClosure<DeriveCanonicalTypeGraphEvidence>;
    readonly targetGraph: ScenarioClosure<DeriveTargetProjectionGraphEvidence>;
    readonly reproduction: ScenarioClosure<ReproduceStructuralModelEvidence>;
    readonly equivalence: ScenarioClosure<DetermineShapeEquivalenceEvidence>;
}
export declare function runStructuralModelProjection(options: {
    readonly repositoryRoot: string;
    readonly executionId?: string;
    readonly target?: ProjectionTarget;
}): Promise<StructuralModelProjectionRun>;
