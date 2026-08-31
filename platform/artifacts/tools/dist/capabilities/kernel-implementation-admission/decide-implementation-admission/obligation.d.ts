import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ImplementationAdmissionEvidence } from "./model.js";
export declare class ImplementationAdmissionObligation implements ObligationEvaluator<ImplementationAdmissionEvidence> {
    readonly obligationId = "every-required-obligation-participates-exactly-once-in-the-verdict";
    evaluate(evidence: ImplementationAdmissionEvidence): ObligationDisposition;
}
