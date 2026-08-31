export class ExecutionConformanceObligation {
    obligationId = "every-canonical-execution-step-has-an-explicit-disposition";
    evaluate(evidence) { if (!evidence.manifestFound)
        return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "every-canonical-step-has-an-embodiment-disposition", reason: "conformance manifest not found" }] }; return { kind: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "every-canonical-step-has-an-embodiment-disposition", disposition: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED", evidenceRef: evidence.manifestPath }] }; }
}
