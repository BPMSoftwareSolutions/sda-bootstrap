export class PublishProjectedCapabilityObligation {
    obligationId = "published-bytes-match-the-proven-plan-and-preserve-untargeted-output";
    evaluate(evidence) {
        const satisfied = evidence.disposition === "PUBLISHED" && evidence.publishedFiles.length > 0;
        return satisfied
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "consumer-publication-is-atomic-complete-and-isolated", disposition: "SATISFIED", evidenceRef: evidence.outputDirectory }] }
            : { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "consumer-publication-is-atomic-complete-and-isolated", reason: "no published consumer files were observed" }] };
    }
}
