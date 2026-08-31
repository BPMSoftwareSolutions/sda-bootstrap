const CONDITION_ID = "every-governed-document-is-correctly-placed-and-paired";
export class GovernedPlacementObligation {
    obligationId = "every-governed-document-is-correctly-placed-and-paired-or-has-a-finding";
    evaluate(evidence) {
        return {
            kind: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED",
            conditionEvidence: [{
                    conditionId: CONDITION_ID,
                    disposition: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED",
                    detail: evidence.conforming ? "all governed documents are correctly placed and paired" : `${evidence.violations.length} governed placement finding(s)`
                }]
        };
    }
}
