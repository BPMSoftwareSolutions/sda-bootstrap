const IMPLEMENTATION_CONFORMANCE_TYPE = "scenario-kernel-implementation-conformance.v1";
function stringField(document, name) {
    const value = document[name];
    return typeof value === "string" ? value : undefined;
}
function validationReason(document, schema) {
    const errors = document.validation?.value.errors ?? [];
    return `does not conform to ${schema}: ${errors.map((error) => `${error.instancePath} ${error.message}`).join("; ")}`;
}
export class GovernedPlacementProvider {
    responsibilityId = "evaluate-placement-and-reference-integrity";
    async execute(input) {
        const violations = [];
        const validFixtures = input.fixtures.filter((document) => {
            if (document.validation?.value.valid)
                return true;
            violations.push({
                rule: "K006A",
                file: document.fact.sourceRef,
                reason: validationReason(document, "scenario-execution-vector-fixture.schema.json")
            });
            return false;
        });
        const validExpectations = input.expectations.filter((document) => {
            if (document.validation?.value.valid)
                return true;
            violations.push({
                rule: "K006B",
                file: document.fact.sourceRef,
                reason: validationReason(document, "scenario-execution-vector-expectation.schema.json")
            });
            return false;
        });
        const expectationsById = new Map(validExpectations.map((document) => [
            stringField(document.fact.value, "expectationId"), document
        ]));
        const fixturesById = new Map(validFixtures.map((document) => [
            stringField(document.fact.value, "fixtureId"), document
        ]));
        for (const fixture of validFixtures) {
            const expectationId = stringField(fixture.fact.value, "expectationId");
            const fixtureId = stringField(fixture.fact.value, "fixtureId");
            const expectation = expectationsById.get(expectationId);
            if (!expectation) {
                violations.push({
                    rule: "K006E",
                    file: fixture.fact.sourceRef,
                    reason: `expectationId "${expectationId}" does not resolve to any file under conformance/expectations/execution`
                });
            }
            else {
                const backReference = stringField(expectation.fact.value, "fixtureId");
                if (backReference !== fixtureId) {
                    violations.push({
                        rule: "K006E",
                        file: fixture.fact.sourceRef,
                        reason: `expectation "${expectation.fact.sourceRef}" back-references fixtureId "${backReference}", expected "${fixtureId}"`
                    });
                }
            }
        }
        for (const expectation of validExpectations) {
            const fixtureId = stringField(expectation.fact.value, "fixtureId");
            if (!fixturesById.has(fixtureId)) {
                violations.push({
                    rule: "K006E",
                    file: expectation.fact.sourceRef,
                    reason: `fixtureId "${fixtureId}" does not resolve to any file under conformance/corpus/execution`
                });
            }
        }
        for (const document of input.languageConformanceClaims) {
            if (document.fact.value["conformanceType"] !== IMPLEMENTATION_CONFORMANCE_TYPE) {
                violations.push({
                    rule: "K006C",
                    file: document.fact.sourceRef,
                    reason: `expected conformanceType "${IMPLEMENTATION_CONFORMANCE_TYPE}", found ${JSON.stringify(document.fact.value["conformanceType"])}`
                });
            }
        }
        for (const document of input.sharedConformanceDocuments) {
            if (document.fact.value["conformanceType"] === IMPLEMENTATION_CONFORMANCE_TYPE) {
                violations.push({
                    rule: "K006D",
                    file: document.fact.sourceRef,
                    reason: "a language-specific implementation-conformance claim must not live under the shared /conformance tree"
                });
            }
        }
        return { violations, conforming: violations.length === 0 };
    }
}
