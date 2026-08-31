export function isProveExperienceClosureInput(value) {
    const input = value;
    return !!input?.capability && Array.isArray(input.fixtures) && !!input.results;
}
export function isProveExperienceClosureEvidence(value) {
    const evidence = value;
    return evidence?.closureType === "consumer-experience-closure.v1" && typeof evidence.experienceId === "string" && Array.isArray(evidence.fixtures);
}
