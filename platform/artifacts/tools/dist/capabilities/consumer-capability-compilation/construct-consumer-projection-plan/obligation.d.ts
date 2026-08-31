import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ConstructConsumerProjectionPlanEvidence } from "./model.js";
export declare class ConstructConsumerProjectionPlanObligation implements ObligationEvaluator<ConstructConsumerProjectionPlanEvidence> {
    readonly obligationId = "every-requested-consumer-artifact-is-planned-without-publication";
    evaluate(evidence: ConstructConsumerProjectionPlanEvidence): ObligationDisposition;
}
