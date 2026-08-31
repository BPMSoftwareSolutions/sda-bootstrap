import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ProveQueryClosureEvidence } from "./model.js";
export declare class ProveQueryClosureObligation implements ObligationEvaluator<ProveQueryClosureEvidence> {
    readonly obligationId = "every-declared-implemented-query-is-observed-or-explicitly-unproven";
    evaluate(evidence: ProveQueryClosureEvidence): ObligationDisposition;
}
