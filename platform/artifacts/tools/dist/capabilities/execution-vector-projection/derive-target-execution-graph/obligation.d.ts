import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { DeriveTargetExecutionGraphEvidence } from "./model.js";
export declare class DeriveTargetExecutionGraphObligation implements ObligationEvaluator<DeriveTargetExecutionGraphEvidence> {
    readonly obligationId = "every-canonical-execution-node-has-one-attributable-target-policy-disposition";
    evaluate(evidence: DeriveTargetExecutionGraphEvidence): ObligationDisposition;
}
