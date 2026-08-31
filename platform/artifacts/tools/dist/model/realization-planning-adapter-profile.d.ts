import type { EnvironmentProfile, RealizationPolicy } from "../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
export interface RealizationPolicyDecisionProfile {
    readonly profileType: "sda-realization-policy-decision-profile.v1";
    readonly profileId: string;
    readonly version: string;
    readonly evaluatorId: string;
    readonly rulesAuthorityDigest: string;
    readonly supportedActivationModes: readonly RealizationPolicy["activation"]["mode"][];
    readonly supportedIdleDispositions: readonly RealizationPolicy["retention"]["idleDisposition"][];
    readonly maximumMinimumWarmInstances: number;
    readonly requireScaleToZero: boolean;
    readonly supportedRehydrationModes: readonly RealizationPolicy["rehydration"]["mode"][];
    readonly supportedPlacementModes: readonly RealizationPolicy["placement"]["mode"][];
    readonly supportedEnvironmentClasses: readonly EnvironmentProfile["environmentClass"][];
    readonly profileDigest: string;
}
export interface RealizationProjectorProfile {
    readonly profileType: "sda-realization-projector-profile.v1";
    readonly profileId: string;
    readonly version: string;
    readonly projectorId: string;
    readonly projectionAuthorityDigest: string;
    readonly actionType: "PROJECT_PROVIDER_ARTIFACT";
    readonly artifactMediaType: "application/vnd.scenario-driven.realization-provider+json";
    readonly artifactNaming: "TARGET_RESPONSIBILITY";
    readonly profileDigest: string;
}
export declare function digestAdapterProfile(profile: object): string;
export declare function cloneFrozenProfile<TValue>(value: TValue): TValue;
