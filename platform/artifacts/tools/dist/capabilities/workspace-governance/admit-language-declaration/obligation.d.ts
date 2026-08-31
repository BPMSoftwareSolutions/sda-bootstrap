import type { ObligationDisposition } from "../../../model/semantic-model.js";
import type { ObligationEvaluator } from "../../../ports/capability-ports.js";
import type { LanguageDeclarationEvidence } from "./model.js";
export declare class LanguageDeclarationObligation implements ObligationEvaluator<LanguageDeclarationEvidence> {
    readonly obligationId = "every-required-declaration-element-has-an-explicit-disposition";
    evaluate(evidence: LanguageDeclarationEvidence): ObligationDisposition;
}
