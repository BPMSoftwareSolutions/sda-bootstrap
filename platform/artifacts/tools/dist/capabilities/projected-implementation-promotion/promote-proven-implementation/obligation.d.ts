import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { PromotionEvidence } from "./model.js";
export declare class PromoteProvenImplementationObligation implements ObligationEvaluator<PromotionEvidence> {
    readonly obligationId = "publication-is-atomic-and-manifest-matches-promoted-bytes";
    evaluate(evidence: PromotionEvidence): ObligationDisposition;
}
