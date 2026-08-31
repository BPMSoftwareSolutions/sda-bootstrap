export class ProveQueryClosureObligation {
    obligationId = "every-declared-implemented-query-is-observed-or-explicitly-unproven";
    evaluate(evidence) {
        return evidence.disposition === "ALL_IMPLEMENTED_QUERIES_OBSERVED"
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "implemented-consumer-queries-have-satisfying-fixture-observations", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "implemented-consumer-queries-have-satisfying-fixture-observations", disposition: "NOT_SATISFIED" }] };
    }
}
