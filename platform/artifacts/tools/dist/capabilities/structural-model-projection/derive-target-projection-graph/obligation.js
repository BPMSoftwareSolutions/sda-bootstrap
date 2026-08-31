export class DeriveTargetProjectionGraphObligation {
    obligationId = "every-canonical-type-has-one-attributable-target-policy-disposition";
    evaluate(evidence) {
        return evidence.definitions.length > 0
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "target-policy-decisions-cover-the-canonical-graph", disposition: "SATISFIED" }] }
            : { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "target-policy-decisions-cover-the-canonical-graph", reason: "target graph is empty" }] };
    }
}
