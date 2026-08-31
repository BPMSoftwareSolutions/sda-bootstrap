// generated from ui-protocol-binding-model.v1; do not edit
import { createHash } from "node:crypto";
export const protocolType = "sda-ui-presentation-ir.v3";
export const protocolSchemaDigest = "sha256:a075cd28d63f51500018549feacca600f2dacb769c06f386c559d9e39b2f8f53";
export function digestCanonicalJson(value) { return "sha256:" + createHash("sha256").update(value).digest("hex"); }
