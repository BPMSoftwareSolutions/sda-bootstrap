export function isProveCrossTargetProjectionEquivalenceInput(value) {
    const input = value;
    return typeof input?.workspaceId === "string" && typeof input.capabilityId === "string" && Array.isArray(input.targets) && input.targets.length >= 2 && Array.isArray(input.executions);
}
export function isProveCrossTargetProjectionEquivalenceEvidence(value) {
    const evidence = value;
    return evidence?.equivalenceType === "consumer-projection-equivalence.v1" && Array.isArray(evidence.fixtures) && Array.isArray(evidence.targets);
}
