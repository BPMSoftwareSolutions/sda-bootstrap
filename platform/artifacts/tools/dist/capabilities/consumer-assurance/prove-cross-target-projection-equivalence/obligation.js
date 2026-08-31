export class ProveCrossTargetProjectionEquivalenceObligation {
    obligationId = "every-fixture-has-an-explicit-equivalence-disposition-for-every-target";
    evaluate(evidence) {
        return evidence.disposition === "BEHAVIORALLY_EQUIVALENT"
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "all-projected-targets-preserve-outcome-and-lineage", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "all-projected-targets-preserve-outcome-and-lineage", disposition: "NOT_SATISFIED" }] };
    }
}
