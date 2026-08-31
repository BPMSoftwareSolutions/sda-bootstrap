import { createHash } from "node:crypto";
function compareUtf16(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
export function canonicalizeJson(value) {
    if (value === null)
        return "null";
    if (typeof value === "string" || typeof value === "boolean")
        return JSON.stringify(value);
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            throw new Error("RFC 8785 canonicalization rejects non-finite numbers.");
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return `[${value.map(canonicalizeJson).join(",")}]`;
    if (typeof value === "object") {
        const record = value;
        const members = Object.keys(record).sort(compareUtf16).map((key) => {
            const member = record[key];
            if (member === undefined)
                throw new Error(`RFC 8785 canonicalization rejects undefined member '${key}'.`);
            return `${JSON.stringify(key)}:${canonicalizeJson(member)}`;
        });
        return `{${members.join(",")}}`;
    }
    throw new Error(`RFC 8785 canonicalization rejects '${typeof value}' values.`);
}
export function sha256Digest(value) {
    return `sha256:${createHash("sha256").update(canonicalizeJson(value)).digest("hex")}`;
}
