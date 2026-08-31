export class BehavioralConformanceObligation {
    obligationId = "every-required-fixture-has-attributable-behavior-evidence-or-an-observation-gap";
    evaluate(evidence) { if (!evidence.ran)
        return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "language-corpus-execution-has-an-attributable-disposition", reason: evidence.reason ?? "language behavior was not observed" }] }; return { kind: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "language-corpus-execution-has-an-attributable-disposition", disposition: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED" }] }; }
}
