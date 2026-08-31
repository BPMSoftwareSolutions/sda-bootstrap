import type { SourceFact } from "../../../model/semantic-model.js";
import type { CanonicalTypeGraph } from "../../../projection/model/canonical-type-graph.js";
import type { StructuralProjectionProfile } from "../../../projection/model/projection-profile.js";
import type { TargetProjectionGraph } from "../../../projection/model/target-projection-graph.js";
export interface DeriveTargetProjectionGraphInput {
    readonly canonical: CanonicalTypeGraph;
    readonly profile: SourceFact<StructuralProjectionProfile>;
}
export type DeriveTargetProjectionGraphEvidence = TargetProjectionGraph;
export declare function isDeriveTargetProjectionGraphInput(value: unknown): value is DeriveTargetProjectionGraphInput;
export declare function isTargetProjectionGraphEvidence(value: unknown): value is DeriveTargetProjectionGraphEvidence;
