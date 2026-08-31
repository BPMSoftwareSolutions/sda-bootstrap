const CONDITION_ID = "every-target-responsibility-has-one-pinned-provider-binding";
export class ConstructDeterministicRealizationPlanObligation {
    obligationId = "planning-produces-one-content-addressed-plan-or-explicit-governed-findings";
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
                    detail: `${evidence.plan.targetResolutions.length} target resolution(s) are pinned`
                }]
        };
    }
}
