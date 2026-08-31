export function isReproduceStructuralModelInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const input = value;
    return typeof input.targetGraph === "object" && typeof input.profile === "object";
}
export function isReproduceStructuralModelEvidence(value) {
    if (!value || typeof value !== "object")
        return false;
    const evidence = value;
    return typeof evidence.outputDirectory === "string" && Array.isArray(evidence.files);
}
