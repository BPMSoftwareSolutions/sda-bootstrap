const CONDITION_ID = "no-binding-status-is-missing-or-unrecognized";
// The canonical binding schema restricts `status` to declared lifecycle
// INTENT only. CONFORMING/ADMITTED are proven facts computed by the
// conformance harness, never hand-set here, so they are not recognized.
const RECOGNIZED_STATUSES = new Set(["DECLARED", "IMPLEMENTING"]);
export class LanguageObligationDeterminationObligation {
    obligationId = "every-binding-has-an-explicit-recognized-lifecycle-disposition";
    evaluate(evidence) {
        const unrecognized = evidence.obligations.filter((entry) => !RECOGNIZED_STATUSES.has(entry.status));
        if (unrecognized.length > 0) {
            return {
                kind: "NOT_SATISFIED",
                conditionEvidence: [{
                        conditionId: CONDITION_ID,
                        disposition: "NOT_SATISFIED",
                        detail: `unrecognized status for: ${unrecognized.map((entry) => `${entry.language}=${entry.status}`).join(", ")}`
                    }]
            };
        }
        return {
            kind: "SATISFIED",
            conditionEvidence: [{
                    conditionId: CONDITION_ID,
                    disposition: "SATISFIED"
                }]
        };
    }
}
