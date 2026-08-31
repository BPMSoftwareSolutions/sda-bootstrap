import type { SourceFact } from "../../../model/semantic-model.js";
import type { CanonicalExecutionGraph } from "../../../projection/model/canonical-execution-graph.js";
import type { StructuralProjectionProfile } from "../../../projection/model/projection-profile.js";
import type { TargetExecutionGraph } from "../../../projection/model/target-execution-graph.js";
export interface DeriveTargetExecutionGraphInput {
    readonly canonical: CanonicalExecutionGraph;
    readonly profile: SourceFact<StructuralProjectionProfile>;
}
export type DeriveTargetExecutionGraphEvidence = TargetExecutionGraph;
export declare function isDeriveTargetExecutionGraphInput(value: unknown): value is DeriveTargetExecutionGraphInput;
export declare function isTargetExecutionGraphEvidence(value: unknown): value is TargetExecutionGraph;
