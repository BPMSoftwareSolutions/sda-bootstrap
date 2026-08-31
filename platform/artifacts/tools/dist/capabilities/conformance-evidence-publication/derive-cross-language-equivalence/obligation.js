export class CrossLanguageEquivalenceObligation {
    obligationId = "every-shared-fixture-has-an-explicit-per-language-equivalence-result";
    evaluate(evidence) {
        const uniqueLanguages = new Set(evidence.languages);
        const uniqueFixtures = new Set(evidence.rows.map((row) => row.fixtureId));
        const complete = evidence.languages.length >= 2 &&
            uniqueLanguages.size === evidence.languages.length &&
            uniqueFixtures.size === evidence.rows.length &&
            evidence.totalFixtures === evidence.rows.length &&
            evidence.equivalentCount === evidence.rows.filter((row) => evidence.languages.every((language) => row.perLanguage[language] === "PASS")).length &&
            evidence.rows.every((row) => {
                const represented = Object.keys(row.perLanguage);
                return represented.length === evidence.languages.length &&
                    evidence.languages.every((language) => row.perLanguage[language] !== undefined);
            });
        return {
            kind: complete ? "SATISFIED" : "NOT_SATISFIED",
            conditionEvidence: [{
                    conditionId: "fixture-language-equivalence-matrix-is-complete",
                    disposition: complete ? "SATISFIED" : "NOT_SATISFIED"
                }]
        };
    }
}
