export const isPreserveAdmittedProjectionInput = (value) => !!value && typeof value === "object" && typeof value.proofConforming === "boolean";
export const isPreservationEvidence = (value) => !!value && typeof value === "object" && typeof value.preserved === "boolean";
