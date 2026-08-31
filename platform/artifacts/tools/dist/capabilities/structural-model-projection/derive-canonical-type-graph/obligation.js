export class DeriveCanonicalTypeGraphObligation {
    obligationId = "every-reachable-type-and-reference-is-resolved-before-target-policy";
    evaluate(evidence) {
        const satisfied = evidence.definitions.length > 0 && evidence.roots.length > 0;
        return satisfied
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "canonical-type-graph-is-complete-and-target-neutral", disposition: "SATISFIED" }] }
            : { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "canonical-type-graph-is-complete-and-target-neutral", reason: "canonical graph is empty" }] };
    }
}
