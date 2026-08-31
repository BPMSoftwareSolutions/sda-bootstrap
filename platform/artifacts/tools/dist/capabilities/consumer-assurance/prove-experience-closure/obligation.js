export class ProveExperienceClosureObligation {
    obligationId = "every-promised-experience-condition-has-an-explicit-observation-disposition";
    evaluate(evidence) {
        return evidence.disposition === "OBSERVABLY_TRUE"
            ? { kind: "SATISFIED", conditionEvidence: [{ conditionId: "consumer-experience-is-realized-by-observed-runtime-outcomes", disposition: "SATISFIED" }] }
            : { kind: "NOT_SATISFIED", conditionEvidence: [{ conditionId: "consumer-experience-is-realized-by-observed-runtime-outcomes", disposition: "NOT_SATISFIED" }] };
    }
}
