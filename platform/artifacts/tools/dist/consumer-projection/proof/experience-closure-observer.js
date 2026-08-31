import { satisfies, valueAt } from "./assertion-evaluator.js";
export class ExperienceClosureObserver {
    observe(input) {
        const experience = input.capability.experience;
        if (!experience || typeof experience.experienceId !== "string" || typeof experience.promise !== "string") {
            throw new Error(`Capability '${String(input.capability.capabilityId)}' declares no promised experience.`);
        }
        const conditions = Array.isArray(experience.observableConditions) ? experience.observableConditions : [];
        const fixtureProofs = input.fixtures.map((fixture) => {
            const result = input.results[String(fixture.fixtureId)];
            if (!result)
                throw new Error(`No execution result exists for fixture '${String(fixture.fixtureId)}'.`);
            const expected = fixture.expected;
            const assertions = Array.isArray(expected.outcomeAssertions) ? expected.outcomeAssertions : [];
            const conditionProofs = conditions.map((condition) => {
                const bindings = assertions.filter((assertion) => assertion.conditionId === condition.conditionId);
                const observations = bindings.map((assertion) => {
                    const actual = valueAt(result.outcome, assertion.path);
                    return { path: assertion.path, operator: assertion.operator, expected: assertion.value, actual: actual ?? null, satisfied: satisfies(actual, assertion) };
                });
                const observed = observations.length > 0 && observations.every((observation) => observation.satisfied);
                return { conditionId: condition.conditionId, statement: condition.statement, observations, disposition: observed ? "OBSERVED" : "NOT_OBSERVED" };
            });
            return {
                fixtureId: fixture.fixtureId,
                conditions: conditionProofs,
                disposition: result.disposition === expected.disposition && conditionProofs.every((condition) => condition.disposition === "OBSERVED")
                    ? "EXPERIENCE_REALIZED" : "EXPERIENCE_NOT_REALIZED"
            };
        });
        return Object.freeze({
            closureType: "consumer-experience-closure.v1",
            capabilityId: String(input.capability.capabilityId),
            experienceId: experience.experienceId,
            promise: experience.promise,
            projectionTarget: "node",
            fixtures: fixtureProofs,
            disposition: fixtureProofs.every((fixture) => fixture.disposition === "EXPERIENCE_REALIZED") ? "OBSERVABLY_TRUE" : "NOT_ESTABLISHED"
        });
    }
}
