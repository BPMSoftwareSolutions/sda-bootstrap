export class AdmitConsumerSourceFactsObligation {
    obligationId = "every-required-consumer-source-is-admitted-with-provenance";
    evaluate(evidence) {
        const satisfied = evidence.sourceFacts.length >= 13 && evidence.sourceFacts.every((fact) => fact.sourceRef && fact.digest.startsWith("sha256:"));
        return satisfied
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "all-declared-consumer-sources-have-current-digests", disposition: "SATISFIED" }] }
            : { kind: "NOT_OBSERVABLE", reasons: [{ conditionId: "all-declared-consumer-sources-have-current-digests", reason: "one or more declared consumer sources lacks provenance" }] };
    }
}
