import type { ConsumerProjectionTarget, PlatformCapability } from "./consumer-workspace-facts.js";
export interface MechanicRequirement {
    readonly mechanicId: string;
    readonly capabilityKind: string;
    readonly requiredBy: string;
    readonly requestedCapabilityId?: string;
}
export type MechanicResolution = MechanicRequirement & ({
    readonly status: "AVAILABLE";
    readonly capabilityId: string;
    readonly provider: string;
    readonly implementationRef: string;
    readonly conformanceRef: string;
} | {
    readonly status: "MISSING";
    readonly reason: "CAPABILITY_NOT_FOUND" | "TARGET_MISMATCH" | "KIND_MISMATCH" | "MECHANIC_NOT_PROVIDED" | "CAPABILITY_NOT_ADMITTED" | "IMPLEMENTATION_EVIDENCE_MISSING";
});
export interface PlatformResponsibilityResolution {
    readonly resolutionType: "consumer-platform-mechanic-resolution.v1";
    readonly projectionTarget: ConsumerProjectionTarget;
    readonly requirements: readonly MechanicRequirement[];
    readonly resolutions: readonly MechanicResolution[];
    readonly disposition: "RESOLVED" | "MISSING";
}
export interface PlatformResponsibilityResolutionEvidence {
    readonly evidenceType: "platform-responsibility-resolution-evidence.v1";
    readonly resolutions: Readonly<Record<ConsumerProjectionTarget, PlatformResponsibilityResolution>>;
    readonly admittedPlatformCapabilities: readonly PlatformCapability[];
    readonly disposition: "RESOLVED" | "MISSING";
}
