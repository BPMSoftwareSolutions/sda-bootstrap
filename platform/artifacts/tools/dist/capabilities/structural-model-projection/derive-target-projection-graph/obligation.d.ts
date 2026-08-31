import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { DeriveTargetProjectionGraphEvidence } from "./model.js";
export declare class DeriveTargetProjectionGraphObligation implements ObligationEvaluator<DeriveTargetProjectionGraphEvidence> {
    readonly obligationId = "every-canonical-type-has-one-attributable-target-policy-disposition";
    evaluate(evidence: DeriveTargetProjectionGraphEvidence): ObligationDisposition;
}
