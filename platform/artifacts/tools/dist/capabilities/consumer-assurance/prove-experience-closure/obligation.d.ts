import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ProveExperienceClosureEvidence } from "./model.js";
export declare class ProveExperienceClosureObligation implements ObligationEvaluator<ProveExperienceClosureEvidence> {
    readonly obligationId = "every-promised-experience-condition-has-an-explicit-observation-disposition";
    evaluate(evidence: ProveExperienceClosureEvidence): ObligationDisposition;
}
