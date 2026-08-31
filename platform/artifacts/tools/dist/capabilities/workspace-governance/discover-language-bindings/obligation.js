const CONDITION_ID = "no-binding-manifest-is-missing-or-duplicated";
export class LanguageBindingDiscoveryObligation {
    obligationId = "every-discoverable-manifest-is-represented-once";
    evaluate(evidence) {
        const missingLineage = evidence.discovered.filter((entry) => !entry.language || !entry.bindingPath);
        if (evidence.duplicateBindingPaths.length > 0 || missingLineage.length > 0) {
            return {
                kind: "NOT_SATISFIED",
                conditionEvidence: [{
                        conditionId: CONDITION_ID,
                        disposition: "NOT_SATISFIED",
                        evidenceRef: evidence.languagesDirectory,
                        detail: `duplicateBindingPaths=${JSON.stringify(evidence.duplicateBindingPaths)}; missingLineageCount=${missingLineage.length}`
                    }]
            };
        }
        return {
            kind: "SATISFIED",
            conditionEvidence: [{
                    conditionId: CONDITION_ID,
                    disposition: "SATISFIED",
                    evidenceRef: evidence.languagesDirectory
                }]
        };
    }
}
