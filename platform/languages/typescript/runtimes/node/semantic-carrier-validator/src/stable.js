import { createHash } from "node:crypto";
export function sortValue(value) {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nested]) => [key, sortValue(nested)]));
    }
    return value;
}
export function stableJson(value) {
    return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}
export function canonicalJson(value) {
    return JSON.stringify(sortValue(value));
}
export function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}
export function normalizeSourceId(sourceId) {
    return sourceId.replaceAll("\\", "/");
}
