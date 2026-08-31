const CONDITION_ID = "every-required-declaration-element-has-an-explicit-disposition";
export class LanguageDeclarationObligation {
    obligationId = "every-required-declaration-element-has-an-explicit-disposition";
    evaluate(evidence) {
        if (evidence.conformanceClaimErrors.includes("conformance manifest not found")) {
            return {
                kind: "NOT_OBSERVABLE",
                reasons: [{ conditionId: CONDITION_ID, reason: "conformance manifest not found" }]
            };
        }
        const satisfied = evidence.bindingValid && evidence.conformanceClaimValid;
        return {
            kind: satisfied ? "SATISFIED" : "NOT_SATISFIED",
            conditionEvidence: [{
                    conditionId: CONDITION_ID,
                    disposition: satisfied ? "SATISFIED" : "NOT_SATISFIED",
                    evidenceRef: evidence.manifestPath
                }]
        };
    }
}
