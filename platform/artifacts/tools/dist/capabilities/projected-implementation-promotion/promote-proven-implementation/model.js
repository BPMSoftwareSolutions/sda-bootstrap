export const isPromoteProvenImplementationInput = (value) => !!value && typeof value === "object" && typeof value.committed === "boolean";
export const isPromotionEvidence = (value) => !!value && typeof value === "object" && typeof value.exactManifest === "boolean";
