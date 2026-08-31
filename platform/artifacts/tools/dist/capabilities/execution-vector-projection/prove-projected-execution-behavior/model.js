export function isProjectedExecutionProofInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const input = value;
    return typeof input.toolchain === "object" && typeof input.behavior === "object" && typeof input.fixtureCount === "number";
}
export const isProjectedExecutionProofEvidence = isProjectedExecutionProofInput;
