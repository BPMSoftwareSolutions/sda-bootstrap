export function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}
export function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}
export function isSourceFact(value, valuePredicate) {
    if (!isRecord(value))
        return false;
    return isNonEmptyString(value["sourceRef"]) &&
        /^sha256:[0-9a-f]{64}$/.test(String(value["digest"])) &&
        isNonEmptyString(value["observedAt"]) &&
        valuePredicate(value["value"]);
}
export function isSchemaAdmissionResult(value) {
    if (!isRecord(value) || typeof value["valid"] !== "boolean" || !Array.isArray(value["errors"])) {
        return false;
    }
    return value["errors"].every((error) => isRecord(error) && typeof error["instancePath"] === "string" && isNonEmptyString(error["message"]));
}
export function isBooleanField(value, field) {
    return isRecord(value) && typeof value[field] === "boolean";
}
