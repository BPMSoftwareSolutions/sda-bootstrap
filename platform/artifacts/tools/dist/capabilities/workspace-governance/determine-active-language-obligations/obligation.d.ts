import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { LanguageObligationEvidence } from "./model.js";
export declare class LanguageObligationDeterminationObligation implements ObligationEvaluator<LanguageObligationEvidence> {
    readonly obligationId = "every-binding-has-an-explicit-recognized-lifecycle-disposition";
    evaluate(evidence: LanguageObligationEvidence): ObligationDisposition;
}
