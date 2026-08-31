export function isDeriveCanonicalExecutionGraphInput(value) {
    return !!value && typeof value === "object" && typeof value.vector === "object";
}
export function isCanonicalExecutionGraphEvidence(value) {
    return !!value && typeof value === "object" && value.vectorType === "scenario-kernel-execution-vector.v1";
}
