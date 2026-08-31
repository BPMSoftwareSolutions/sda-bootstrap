import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { GovernedPlacementEvidence } from "./model.js";
export declare class GovernedPlacementObligation implements ObligationEvaluator<GovernedPlacementEvidence> {
    readonly obligationId = "every-governed-document-is-correctly-placed-and-paired-or-has-a-finding";
    evaluate(evidence: GovernedPlacementEvidence): ObligationDisposition;
}
