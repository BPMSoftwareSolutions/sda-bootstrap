function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]));
    }
    return value;
}
function assertionKey(assertion) {
    return JSON.stringify(canonical(assertion));
}
function manifestAssertions(manifest) {
    const assertions = manifest.dataAuthority;
    return Array.isArray(assertions) ? assertions : [];
}
export class AuthorityConformanceProvider {
    responsibilityId = "compare-observed-and-canonical-authority";
    async execute(input) {
        if (!input.manifest) {
            return {
                language: input.language,
                manifestPath: input.manifestPath,
                manifestFound: false,
                assertionCount: 0,
                conforming: false
            };
        }
        const assertions = manifestAssertions(input.manifest.value);
        const expectedAssertions = input.canonicalAuthority.value.assertions;
        const actualKeys = new Set(assertions.map(assertionKey));
        const expectedKeys = new Set(expectedAssertions.map(assertionKey));
        const missingAssertions = expectedAssertions.filter((assertion) => !actualKeys.has(assertionKey(assertion)));
        const unexpectedAssertions = assertions.filter((assertion) => !expectedKeys.has(assertionKey(assertion)));
        const assertionSetConforming = missingAssertions.length === 0 && unexpectedAssertions.length === 0;
        const manifestValid = input.manifestValidation?.value.valid ?? false;
        const sourceInspection = input.sourceInspection?.value ?? {
            conforming: false,
            sourceRefs: [],
            checks: [],
            reason: "source inspection was not observable"
        };
        return {
            language: input.language,
            manifestPath: input.manifestPath,
            manifestFound: true,
            manifestValid,
            assertionCount: assertions.length,
            canonicalAssertionCount: expectedAssertions.length,
            assertionSetConforming,
            missingAssertions,
            unexpectedAssertions,
            sourceInspection,
            conforming: manifestValid && assertionSetConforming && sourceInspection.conforming
        };
    }
}
export { assertionKey };
