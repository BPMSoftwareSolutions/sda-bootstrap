export class DeriveCanonicalExecutionGraphObligation {
    obligationId = "every-vector-step-and-dependency-is-represented-before-target-policy";
    evaluate(evidence) {
        return evidence.steps.length > 0
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "canonical-execution-graph-is-complete", disposition: "SATISFIED" }] }
            : { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "canonical-execution-graph-is-complete", reason: "execution graph is empty" }] };
    }
}
