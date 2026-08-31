export class StageProjectedCandidateObligation {
    obligationId = "staging-does-not-modify-the-admitted-implementation";
    evaluate(evidence) {
        const satisfied = evidence.stagingDirectory.length > 0 && !evidence.admittedBytesModified;
        return { kind: satisfied ? "SATISFIED" : "NOT_SATISFIED", conditionEvidence: [{ conditionId: "candidate-is-staged-outside-the-admitted-destination", disposition: satisfied ? "SATISFIED" : "NOT_SATISFIED" }] };
    }
}
