export declare const protocolType: "sda-ui-presentation-ir.v3";
export declare const protocolSchemaDigest: "sha256:a075cd28d63f51500018549feacca600f2dacb769c06f386c559d9e39b2f8f53";
export type CapabilityCategory = "COMPOSITION" | "CONTENT" | "INTERACTION" | "ADAPTATION" | "ACCESSIBILITY" | "PROFILE" | "TOKEN";
export type EvidenceCapability = "ACCESSIBILITY" | "ADAPTATION" | "OBSERVATION";
export interface UiCapabilityRequirement {
    readonly capabilityId: string;
    readonly category: CapabilityCategory;
    readonly sourceRefs: readonly string[];
    readonly evidenceRequirements: readonly EvidenceCapability[];
}
export interface UiEmbodimentPlanV1 {
    readonly planType: "ui-embodiment-plan.v1";
    readonly canonicalDigest: `sha256:${string}`;
}
export declare function digestCanonicalJson(value: string): string;
