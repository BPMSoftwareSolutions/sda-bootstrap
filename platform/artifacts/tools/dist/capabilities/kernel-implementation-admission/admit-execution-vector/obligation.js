export class ExecutionVectorAdmissionObligation {
    obligationId = "every-declared-step-and-ordering-constraint-is-admitted";
    evaluate(evidence) {
        if (!evidence.found)
            return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "canonical-execution-vector-is-schema-admitted", reason: evidence.errors[0] ?? "execution vector unavailable" }] };
        return { kind: evidence.valid ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "canonical-execution-vector-is-schema-admitted", disposition: evidence.valid ? "SATISFIED" : "NOT_SATISFIED", evidenceRef: evidence.executionVectorPath }] };
    }
}
