import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ProveProjectedExecutionBehaviorEvidence } from "./model.js";
export declare class ProveProjectedExecutionBehaviorObligation implements ObligationEvaluator<ProveProjectedExecutionBehaviorEvidence> {
    readonly obligationId = "every-fixture-has-equivalent-behavior-or-an-explicit-evidence-gap";
    evaluate(evidence: ProveProjectedExecutionBehaviorEvidence): ObligationDisposition;
}
