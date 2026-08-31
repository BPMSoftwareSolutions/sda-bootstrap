import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { KernelSpecificationAdmissionEvidence } from "./model.js";
export declare class KernelSpecificationAdmissionObligation implements ObligationEvaluator<KernelSpecificationAdmissionEvidence> {
    readonly obligationId = "every-specification-requirement-is-admitted-or-identified";
    evaluate(evidence: KernelSpecificationAdmissionEvidence): ObligationDisposition;
}
