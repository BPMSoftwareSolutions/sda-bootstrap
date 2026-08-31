import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ReproduceTargetExecutionVectorEvidence } from "./model.js";
export declare class ReproduceTargetExecutionVectorObligation implements ObligationEvaluator<ReproduceTargetExecutionVectorEvidence> {
    readonly obligationId = "every-target-execution-node-has-a-deterministic-embodiment";
    evaluate(evidence: ReproduceTargetExecutionVectorEvidence): ObligationDisposition;
}
