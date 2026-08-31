import { type DeriveCanonicalExecutionGraphEvidence } from "../../capabilities/execution-vector-projection/derive-canonical-execution-graph/model.js";
import { type DeriveTargetExecutionGraphEvidence } from "../../capabilities/execution-vector-projection/derive-target-execution-graph/model.js";
import { type ReproduceTargetExecutionVectorEvidence } from "../../capabilities/execution-vector-projection/reproduce-target-execution-vector/model.js";
import { type ProveProjectedExecutionBehaviorEvidence } from "../../capabilities/execution-vector-projection/prove-projected-execution-behavior/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
import type { ProjectionTarget } from "../../projection/model/projection-profile.js";
export interface ExecutionVectorProjectionRun {
    readonly canonical: ScenarioClosure<DeriveCanonicalExecutionGraphEvidence>;
    readonly targetGraph: ScenarioClosure<DeriveTargetExecutionGraphEvidence>;
    readonly reproduction: ScenarioClosure<ReproduceTargetExecutionVectorEvidence>;
    readonly proof: ScenarioClosure<ProveProjectedExecutionBehaviorEvidence>;
}
export declare function runExecutionVectorProjection(options: {
    readonly repositoryRoot: string;
    readonly target?: ProjectionTarget;
    readonly executionId?: string;
}): Promise<ExecutionVectorProjectionRun>;
