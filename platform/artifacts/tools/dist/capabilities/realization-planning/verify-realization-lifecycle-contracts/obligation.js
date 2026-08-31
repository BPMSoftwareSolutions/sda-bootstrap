export class VerifyRealizationLifecycleContractsObligation {
    obligationId = "lifecycle-artifacts-preserve-causal-and-independent-lifetimes";
    evaluate(evidence) {
        return evidence.disposition === "COHERENT"
            ? {
                kind: "SATISFIED",
                conditionEvidence: [{
                        conditionId: "lineage-stage-proof-and-availability-contracts-are-content-addressed-and-coherent",
                        disposition: "SATISFIED"
                    }]
            }
            : {
                kind: "NOT_SATISFIED",
                conditionEvidence: evidence.findings.map((finding) => ({
                    conditionId: "lineage-stage-proof-and-availability-contracts-are-content-addressed-and-coherent",
                    disposition: "NOT_SATISFIED",
                    detail: `${finding.code}: ${finding.detail}`
                }))
            };
    }
}
