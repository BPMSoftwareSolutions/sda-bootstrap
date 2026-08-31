import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ExecutionConformanceEvidence } from "./model.js";
export declare class ExecutionConformanceObligation implements ObligationEvaluator<ExecutionConformanceEvidence> {
    readonly obligationId = "every-canonical-execution-step-has-an-explicit-disposition";
    evaluate(evidence: ExecutionConformanceEvidence): ObligationDisposition;
}
