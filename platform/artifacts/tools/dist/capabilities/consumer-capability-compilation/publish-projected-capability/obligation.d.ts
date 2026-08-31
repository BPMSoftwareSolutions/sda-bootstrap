import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { PublishProjectedCapabilityEvidence } from "./model.js";
export declare class PublishProjectedCapabilityObligation implements ObligationEvaluator<PublishProjectedCapabilityEvidence> {
    readonly obligationId = "published-bytes-match-the-proven-plan-and-preserve-untargeted-output";
    evaluate(evidence: PublishProjectedCapabilityEvidence): ObligationDisposition;
}
