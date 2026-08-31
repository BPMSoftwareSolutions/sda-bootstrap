import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { CrossLanguageEquivalenceEvidence } from "./model.js";
export declare class CrossLanguageEquivalenceObligation implements ObligationEvaluator<CrossLanguageEquivalenceEvidence> {
    readonly obligationId = "every-shared-fixture-has-an-explicit-per-language-equivalence-result";
    evaluate(evidence: CrossLanguageEquivalenceEvidence): ObligationDisposition;
}
