const CONDITION_ID = "every-canonical-type-has-a-target-embodiment-with-no-duplicate-path";
export class ReproduceTargetStructuralModelObligation {
    obligationId = "every-canonical-type-has-a-target-embodiment-and-deterministic-plan-bytes";
    evaluate(evidence) {
        if (evidence.files.length === 0) {
            return {
                kind: "NOT_OBSERVABLE",
                reasons: [{ conditionId: CONDITION_ID, reason: "projection plan produced no files" }]
            };
        }
        const seen = new Set();
        const duplicates = new Set();
        for (const file of evidence.files) {
            if (seen.has(file.relativePath))
                duplicates.add(file.relativePath);
            seen.add(file.relativePath);
        }
        if (duplicates.size > 0) {
            return {
                kind: "NOT_SATISFIED",
                conditionEvidence: [{
                        conditionId: CONDITION_ID,
                        disposition: "NOT_SATISFIED",
                        detail: `duplicate plan paths: ${[...duplicates].sort().join(", ")}`
                    }]
            };
        }
        return {
            kind: "SATISFIED",
            conditionEvidence: [{
                    conditionId: CONDITION_ID,
                    disposition: "SATISFIED",
                    evidenceRef: evidence.outputDirectory
                }]
        };
    }
}
