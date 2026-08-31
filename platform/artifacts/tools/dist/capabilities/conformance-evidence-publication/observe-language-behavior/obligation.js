export class ObserveLanguageBehaviorObligation {
    obligationId = "every-targeted-language-produces-evidence-or-an-explicit-not-observable-reason";
    evaluate(evidence) { if (!evidence.ran)
        return { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "language-observation-has-a-result-or-environment-gap", reason: evidence.reason ?? "language suite did not run" }] }; return { kind: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "language-observation-has-a-result-or-environment-gap", disposition: evidence.conforming ? "SATISFIED" : "NOT_SATISFIED" }] }; }
}
