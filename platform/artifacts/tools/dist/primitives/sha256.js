import { createHash } from "node:crypto";
export function sha256(value) {
    return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
