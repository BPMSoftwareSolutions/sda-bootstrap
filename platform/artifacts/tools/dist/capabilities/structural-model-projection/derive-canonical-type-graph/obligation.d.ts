import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { DeriveCanonicalTypeGraphEvidence } from "./model.js";
export declare class DeriveCanonicalTypeGraphObligation implements ObligationEvaluator<DeriveCanonicalTypeGraphEvidence> {
    readonly obligationId = "every-reachable-type-and-reference-is-resolved-before-target-policy";
    evaluate(evidence: DeriveCanonicalTypeGraphEvidence): ObligationDisposition;
}
