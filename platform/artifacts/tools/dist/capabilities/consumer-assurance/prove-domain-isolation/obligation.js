export class ProveDomainIsolationObligation {
    obligationId = "no-external-domain-term-or-rule-is-embedded-in-sda-mechanics";
    evaluate(evidence) {
        return evidence.valid
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "consumer-tooling-and-generic-fixtures-remain-domain-neutral", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "consumer-tooling-and-generic-fixtures-remain-domain-neutral", disposition: "NOT_SATISFIED", detail: JSON.stringify(evidence.violations) }] };
    }
}
