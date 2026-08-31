export function isDetermineShapeEquivalenceInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const input = value;
    return typeof input.plan === "object" && typeof input.admittedSource === "object";
}
export function isDetermineShapeEquivalenceEvidence(value) {
    if (!value || typeof value !== "object")
        return false;
    const evidence = value;
    return Array.isArray(evidence.results) &&
        typeof evidence.matchCount === "number" &&
        typeof evidence.totalCount === "number";
}
