export function isDeriveTargetProjectionGraphInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const input = value;
    return typeof input.canonical === "object" && typeof input.profile === "object";
}
export function isTargetProjectionGraphEvidence(value) {
    return !!value && typeof value === "object" && value.graphType === "target-projection-graph.v1";
}
