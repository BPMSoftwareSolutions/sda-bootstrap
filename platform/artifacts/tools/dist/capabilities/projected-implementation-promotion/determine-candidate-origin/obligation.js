export class DetermineCandidateOriginObligation {
    obligationId = "every-candidate-file-has-an-explicit-origin";
    evaluate(evidence) {
        return evidence.origin === "UNKNOWN" ? { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "candidate-origin-is-attributable", reason: "candidate has no attributable files" }] } : { kind: "SATISFIED", conditionEvidence: [{ conditionId: "candidate-origin-is-attributable", disposition: "SATISFIED" }] };
    }
}
