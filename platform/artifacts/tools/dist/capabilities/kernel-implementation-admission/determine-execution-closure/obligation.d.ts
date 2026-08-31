import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ExecutionClosureEvidence } from "./model.js";
export declare class ExecutionClosureObligation implements ObligationEvaluator<ExecutionClosureEvidence> {
    readonly obligationId = "every-observed-execution-is-gap-free-or-has-a-precise-closure-finding";
    evaluate(evidence: ExecutionClosureEvidence): ObligationDisposition;
}
