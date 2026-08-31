export type CanonicalInterfaceKind = "semantic" | "cli" | "api" | "sdk" | "ui" | "mcp" | "agent" | "message" | "rpc" | "other";
export type AdmittedInterfaceKind = CanonicalInterfaceKind | "http";
export declare function canonicalizeInterfaceKind(kind: AdmittedInterfaceKind): CanonicalInterfaceKind;
