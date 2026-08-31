import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { AuthorityConformanceEvidence } from "./model.js";
export declare class AuthorityConformanceObligation implements ObligationEvaluator<AuthorityConformanceEvidence> {
    readonly obligationId = "every-authority-requirement-has-a-disposition";
    evaluate(evidence: AuthorityConformanceEvidence): ObligationDisposition;
}
