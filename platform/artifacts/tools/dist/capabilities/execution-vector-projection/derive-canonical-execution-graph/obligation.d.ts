import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { DeriveCanonicalExecutionGraphEvidence } from "./model.js";
export declare class DeriveCanonicalExecutionGraphObligation implements ObligationEvaluator<DeriveCanonicalExecutionGraphEvidence> {
    readonly obligationId = "every-vector-step-and-dependency-is-represented-before-target-policy";
    evaluate(evidence: DeriveCanonicalExecutionGraphEvidence): ObligationDisposition;
}
