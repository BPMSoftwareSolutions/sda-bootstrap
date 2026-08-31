import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { DetermineShapeEquivalenceEvidence } from "./model.js";
export declare class DetermineProjectedShapeEquivalenceObligation implements ObligationEvaluator<DetermineShapeEquivalenceEvidence> {
    readonly obligationId = "every-canonical-type-has-an-explicit-shape-disposition";
    evaluate(evidence: DetermineShapeEquivalenceEvidence): ObligationDisposition;
}
