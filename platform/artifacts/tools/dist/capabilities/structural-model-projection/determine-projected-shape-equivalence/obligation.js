const CONDITION_ID = "every-canonical-type-has-an-explicit-match-or-finding";
export class DetermineProjectedShapeEquivalenceObligation {
    obligationId = "every-canonical-type-has-an-explicit-shape-disposition";
    evaluate(evidence) {
        const findings = evidence.results.filter((r) => r.status !== "MATCH");
        if (findings.length > 0) {
            return {
                kind: "NOT_SATISFIED",
                conditionEvidence: [{
                        conditionId: CONDITION_ID,
                        disposition: "NOT_SATISFIED",
                        detail: `${findings.length} of ${evidence.totalCount} type(s) not matched: ${findings.map((f) => `${f.typeName}=${f.status}`).join(", ")}`
                    }]
            };
        }
        return {
            kind: "SATISFIED",
            conditionEvidence: [{
                    conditionId: CONDITION_ID,
                    disposition: "SATISFIED",
                    detail: `${evidence.matchCount} / ${evidence.totalCount} types match member-for-member`
                }]
        };
    }
}
