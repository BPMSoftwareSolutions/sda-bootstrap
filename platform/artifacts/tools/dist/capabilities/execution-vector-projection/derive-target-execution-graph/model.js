export function isDeriveTargetExecutionGraphInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const input = value;
    return typeof input.canonical === "object" && typeof input.profile === "object";
}
export function isTargetExecutionGraphEvidence(value) {
    return !!value && typeof value === "object" && value.graphType === "target-execution-graph.v1";
}
