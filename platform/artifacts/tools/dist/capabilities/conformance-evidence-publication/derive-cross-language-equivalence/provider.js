export class CrossLanguageEquivalenceProvider {
    responsibilityId = "compare-fixture-dispositions-across-languages";
    async execute(input) {
        const languages = input.admissions.map((item) => item.language);
        const rows = input.fixtures.map((fixture) => {
            const perLanguage = Object.fromEntries(input.admissions.map((admission) => {
                const behavioral = admission.details["behavioral"];
                const disposition = behavioral?.ran !== true
                    ? "NOT_READY"
                    : behavioral.conforming === true ? "PASS" : "UNVERIFIED";
                return [admission.language, disposition];
            }));
            return { ...fixture, perLanguage };
        });
        return {
            languages,
            rows,
            equivalentCount: rows.filter((row) => languages.every((language) => row.perLanguage[language] === "PASS")).length,
            totalFixtures: rows.length
        };
    }
}
