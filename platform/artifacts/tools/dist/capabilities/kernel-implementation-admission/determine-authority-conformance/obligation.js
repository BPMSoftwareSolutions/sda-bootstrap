const CONDITION_ID = "no-authority-requirement-disappears";
export class AuthorityConformanceObligation {
    obligationId = "every-authority-requirement-has-a-disposition";
    evaluate(evidence) {
        if (!evidence.manifestFound) {
            return {
                kind: "NOT_OBSERVABLE",
                reasons: [{ conditionId: CONDITION_ID, reason: "implementation conformance manifest was not found" }]
            };
        }
        if (!evidence.sourceInspection || evidence.sourceInspection.missingSourceRefs?.length) {
            return {
                kind: "NOT_OBSERVABLE",
                reasons: [{ conditionId: CONDITION_ID, reason: "one or more admitted implementation sources could not be inspected" }]
            };
        }
        if (!evidence.conforming) {
            return {
                kind: "NOT_SATISFIED",
                conditionEvidence: [{
                        conditionId: CONDITION_ID,
                        disposition: "NOT_SATISFIED",
                        evidenceRef: evidence.manifestPath,
                        detail: `manifestValid=${evidence.manifestValid}; assertionSetConforming=${evidence.assertionSetConforming}; sourceConforming=${evidence.sourceInspection.conforming}`
                    }]
            };
        }
        return {
            kind: "SATISFIED",
            conditionEvidence: [{
                    conditionId: CONDITION_ID,
                    disposition: "SATISFIED",
                    evidenceRef: evidence.manifestPath
                }]
        };
    }
}
