export class ProveProjectedSterilityBeforePublicationObligation {
    obligationId = "every-planned-executable-file-has-an-explicit-sterility-disposition";
    evaluate(evidence) {
        return evidence.disposition === "PURE_PROJECTION_CONFORMS"
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "planned-consumer-executables-are-mechanically-sterile", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{
                        conditionId: "planned-consumer-executables-are-mechanically-sterile",
                        disposition: "NOT_SATISFIED",
                        detail: JSON.stringify(evidence.violations)
                    }] };
    }
}
