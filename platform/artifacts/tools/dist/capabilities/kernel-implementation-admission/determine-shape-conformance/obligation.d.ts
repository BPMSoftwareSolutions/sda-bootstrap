import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { ShapeConformanceEvidence } from "./model.js";
export declare class ShapeConformanceObligation implements ObligationEvaluator<ShapeConformanceEvidence> {
    readonly obligationId = "every-canonical-object-has-an-explicit-shape-disposition";
    evaluate(evidence: ShapeConformanceEvidence): ObligationDisposition;
}
