import crypto from "node:crypto";
export function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        const source = value;
        return Object.fromEntries(Object.keys(source).sort().map((key) => [key, canonicalize(source[key])]));
    }
    return value;
}
export function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
}
export function sha256(value) {
    return `sha256:${crypto.createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}
export function digestDocument(value, excludedKeys = []) {
    if (value === null || typeof value !== "object" || Array.isArray(value) || excludedKeys.length === 0)
        return sha256(value);
    const excluded = new Set(excludedKeys);
    return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.has(key))));
}
