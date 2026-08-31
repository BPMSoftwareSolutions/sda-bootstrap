import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { StageProjectedCandidateEvidence } from "./model.js";
export declare class StageProjectedCandidateObligation implements ObligationEvaluator<StageProjectedCandidateEvidence> {
    readonly obligationId = "staging-does-not-modify-the-admitted-implementation";
    evaluate(evidence: StageProjectedCandidateEvidence): ObligationDisposition;
}
