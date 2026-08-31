export const isStageProjectedCandidateInput = (value) => !!value && typeof value === "object" && typeof value.stagingDirectory === "string";
export const isStageProjectedCandidateEvidence = isStageProjectedCandidateInput;
