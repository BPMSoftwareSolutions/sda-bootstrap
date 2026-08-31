import { createHash } from "node:crypto";
export function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value && typeof value === "object") {
        const record = value;
        return Object.fromEntries(Object.keys(record).sort().map((key) => [key, canonicalize(record[key])]));
    }
    return value;
}
function encoded(value) { return JSON.stringify(canonicalize(value)); }
function digest(value) { return createHash("sha256").update(encoded(value)).digest("hex"); }
export class ProjectionEquivalenceObserver {
    observe(input) {
        const canonicalTarget = input.targets[0];
        if (!canonicalTarget || input.targets.length < 2)
            throw new Error("Equivalence observation requires at least two projection targets.");
        const fixtureIds = [...new Set(input.executions.map((fact) => fact.fixtureId))];
        const fixtures = fixtureIds.map((fixtureId) => {
            const facts = input.executions.filter((fact) => fact.fixtureId === fixtureId);
            const canonical = facts.find((fact) => fact.target === canonicalTarget);
            if (!canonical)
                throw new Error(`Fixture '${fixtureId}' has no canonical '${canonicalTarget}' execution.`);
            const canonicalOutcome = encoded(canonical.result.outcome);
            const canonicalExecutions = Array.isArray(canonical.result.executions) ? canonical.result.executions : [];
            const canonicalSequence = canonicalExecutions.map((execution) => execution.scenarioId);
            const targetProofs = input.targets.map((target) => {
                const fact = facts.find((candidate) => candidate.target === target);
                if (!fact)
                    throw new Error(`Fixture '${fixtureId}' has no '${target}' execution.`);
                const executions = Array.isArray(fact.result.executions) ? fact.result.executions : [];
                const sequence = executions.map((execution) => execution.scenarioId);
                return {
                    projectionTarget: target,
                    outcomeSha256: digest(fact.result.outcome),
                    scenarioSequence: sequence,
                    runtimeDisposition: fact.result.disposition,
                    mechanicResolution: fact.mechanicResolution,
                    executableOrigin: fact.executableOrigin,
                    outcomeEquivalent: encoded(fact.result.outcome) === canonicalOutcome,
                    lineageEquivalent: encoded(sequence) === encoded(canonicalSequence)
                };
            });
            const equivalent = targetProofs.every((proof) => proof.outcomeEquivalent && proof.lineageEquivalent &&
                proof.mechanicResolution === "RESOLVED" && proof.executableOrigin === "PROJECTED_ONLY");
            return {
                fixtureId,
                canonicalOutcomeSha256: digest(canonical.result.outcome),
                targets: targetProofs,
                disposition: equivalent ? "EQUIVALENT" : "DIVERGENT"
            };
        });
        return Object.freeze({
            equivalenceType: "consumer-projection-equivalence.v1",
            workspaceId: input.workspaceId,
            capabilityId: input.capabilityId,
            canonicalTarget,
            targets: input.targets,
            fixtures,
            disposition: fixtures.every((fixture) => fixture.disposition === "EQUIVALENT") ? "BEHAVIORALLY_EQUIVALENT" : "DIVERGENT"
        });
    }
}
