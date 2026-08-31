const CONDITION_ID = "every-registry-selector-has-one-immutable-digest-resolution";
export class ResolveRegisteredRealizationPlanObligation {
    obligationId = "every-selector-resolves-to-pinned-authority-before-planning";
    evaluate(evidence) {
        if (evidence.disposition === "BLOCKED") {
            return {
                kind: "NOT_SATISFIED",
                conditionEvidence: [{
                        conditionId: CONDITION_ID,
                        disposition: "NOT_SATISFIED",
                        detail: evidence.findings.map((finding) => finding.code).join(", ")
                    }]
            };
        }
        return {
            kind: "SATISFIED",
            conditionEvidence: [{
                    conditionId: CONDITION_ID,
                    disposition: "SATISFIED",
                    evidenceRef: evidence.plan.planDigest,
                    detail: `${evidence.resolutionDecisions.length} selector resolution(s) are pinned`
                }]
        };
    }
}
