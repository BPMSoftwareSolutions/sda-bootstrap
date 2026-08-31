import type { JsonRecord, MandatoryMechanicProfile, PlatformCapabilityCatalog } from "./consumer-workspace-facts.js";
export interface ConsumerPlatformObservation {
    readonly language: string;
    readonly command?: string;
    readonly ran?: boolean;
    readonly exitCode?: number | null;
    readonly conforming: boolean;
    readonly disposition: "SATISFIED" | "NOT_SATISFIED" | "NOT_OBSERVABLE";
    readonly proofInputDigest: string;
    readonly reason?: string;
    readonly stderr?: string;
}
export interface LanguageBinding extends JsonRecord {
    readonly language: string;
    readonly status: string;
    readonly implementationId: string;
}
export interface MechanicConformanceFacts {
    readonly authority: MandatoryMechanicProfile;
    readonly catalog: PlatformCapabilityCatalog;
    readonly bindings: readonly LanguageBinding[];
    readonly observations: Readonly<Record<string, ConsumerPlatformObservation>>;
    readonly currentProofDigests: Readonly<Record<string, string>>;
    readonly kernelAdmissions: Readonly<Record<string, string>>;
    readonly availableCapabilityIds: ReadonlySet<string>;
}
export interface LanguageMechanicProfileResolution extends JsonRecord {
    readonly resolutionType: "sda-language-mechanic-profile-resolution.v1";
    readonly profileId: string;
    readonly languages: readonly JsonRecord[];
}
