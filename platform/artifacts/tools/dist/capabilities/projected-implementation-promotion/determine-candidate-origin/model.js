export const isDetermineCandidateOriginInput = (value) => !!value && typeof value === "object" && typeof value.plan === "object";
export const isCandidateOriginEvidence = (value) => !!value && typeof value === "object" && typeof value.origin === "string";
