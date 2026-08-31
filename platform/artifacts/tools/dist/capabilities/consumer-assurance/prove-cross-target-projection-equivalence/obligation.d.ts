import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ProveCrossTargetProjectionEquivalenceEvidence } from "./model.js";
export declare class ProveCrossTargetProjectionEquivalenceObligation implements ObligationEvaluator<ProveCrossTargetProjectionEquivalenceEvidence> {
    readonly obligationId = "every-fixture-has-an-explicit-equivalence-disposition-for-every-target";
    evaluate(evidence: ProveCrossTargetProjectionEquivalenceEvidence): ObligationDisposition;
}
