export class PreserveAdmittedProjectionObligation {
    obligationId = "previously-admitted-and-untargeted-artifacts-remain-byte-identical";
    evaluate(evidence) {
        return { kind: evidence.preserved ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "failed-regeneration-preserves-admitted-bytes", disposition: evidence.preserved ? "SATISFIED" : "NOT_SATISFIED" }] };
    }
}
