export class PublishImplementationEvidenceObligation {
    obligationId = "published-evidence-includes-source-inputs-environment-dispositions-and-digest";
    evaluate(evidence) {
        const satisfied = evidence.conformanceType === "scenario-kernel-admission-result.v1" &&
            /^sha256:[0-9a-f]{64}$/.test(evidence.proofInputDigest) &&
            !Number.isNaN(Date.parse(evidence.generatedAt)) &&
            evidence.obligations.length > 0 &&
            evidence.obligations.every((item) => item.scenarioId.length > 0 && item.obligationId.length > 0 && item.evidenceRef.length > 0);
        return {
            kind: satisfied ? "SATISFIED" : "NOT_SATISFIED",
            conditionEvidence: [{
                    conditionId: "published-artifact-is-current-attributable-and-complete",
                    disposition: satisfied ? "SATISFIED" : "NOT_SATISFIED"
                }]
        };
    }
}
