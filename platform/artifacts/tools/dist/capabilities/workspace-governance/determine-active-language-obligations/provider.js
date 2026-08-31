const DECLARED_STATUS = "DECLARED";
export class LanguageObligationDeterminationProvider {
    responsibilityId = "classify-binding-as-active-or-informational";
    async execute(input) {
        const obligations = input.bindingFiles.map(({ language, fact }) => {
            const rawStatus = fact.value["status"];
            const status = typeof rawStatus === "string" && rawStatus.length > 0 ? rawStatus : "UNKNOWN";
            const isActiveObligation = rawStatus !== undefined && rawStatus !== null && rawStatus !== DECLARED_STATUS;
            return {
                language,
                bindingPath: fact.sourceRef,
                binding: fact.value,
                status,
                isActiveObligation
            };
        });
        return { obligations };
    }
}
