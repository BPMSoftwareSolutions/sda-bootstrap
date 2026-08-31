export function isDeriveCanonicalTypeGraphInput(value) {
    if (!value || typeof value !== "object")
        return false;
    const input = value;
    return typeof input.schemas === "object" && Array.isArray(input.roots) && input.roots.length > 0;
}
export function isCanonicalTypeGraphEvidence(value) {
    return !!value && typeof value === "object" && Array.isArray(value.definitions);
}
