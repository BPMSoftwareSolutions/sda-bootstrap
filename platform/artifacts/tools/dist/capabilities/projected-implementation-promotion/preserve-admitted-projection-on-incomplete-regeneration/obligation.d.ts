import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { PreservationEvidence } from "./model.js";
export declare class PreserveAdmittedProjectionObligation implements ObligationEvaluator<PreservationEvidence> {
    readonly obligationId = "previously-admitted-and-untargeted-artifacts-remain-byte-identical";
    evaluate(evidence: PreservationEvidence): ObligationDisposition;
}
