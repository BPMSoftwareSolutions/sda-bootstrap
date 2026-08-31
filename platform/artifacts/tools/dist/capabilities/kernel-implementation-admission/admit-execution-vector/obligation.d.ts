import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ExecutionVectorAdmissionEvidence } from "./model.js";
export declare class ExecutionVectorAdmissionObligation implements ObligationEvaluator<ExecutionVectorAdmissionEvidence> {
    readonly obligationId = "every-declared-step-and-ordering-constraint-is-admitted";
    evaluate(evidence: ExecutionVectorAdmissionEvidence): ObligationDisposition;
}
