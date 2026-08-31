import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { CandidateOriginEvidence } from "./model.js";
export declare class DetermineCandidateOriginObligation implements ObligationEvaluator<CandidateOriginEvidence> {
    readonly obligationId = "every-candidate-file-has-an-explicit-origin";
    evaluate(evidence: CandidateOriginEvidence): ObligationDisposition;
}
