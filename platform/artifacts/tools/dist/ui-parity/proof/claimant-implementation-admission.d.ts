import type { UiEmbodimentTarget, UiObjectModel } from "../model/ui-parity.js";
export interface UiClaimantImplementation {
    readonly claimantImplementationType: "consumer-ui-claimant-implementation.v1";
    readonly embodimentTarget: UiEmbodimentTarget;
    readonly objectModelRef: string;
    readonly disposition: "NATIVE_PROOF_ADMITTED" | "IMPLEMENTED_AWAITING_NATIVE_PROOF";
    readonly conceptGroups: readonly {
        readonly implementationRef: string;
        readonly representation: string;
        readonly conceptIds: readonly string[];
    }[];
    readonly nativeAdmissionRequirements: readonly string[];
}
export interface UiClaimantImplementationAdmission {
    readonly target: UiEmbodimentTarget;
    readonly claimedConceptCount: number;
    readonly requiredConceptCount: number;
    readonly findings: readonly string[];
    readonly disposition: "PASS" | "FAIL";
}
export declare function admitUiClaimantImplementation(repositoryRoot: string, implementationRef: string, target: UiEmbodimentTarget, objectModel: UiObjectModel): UiClaimantImplementationAdmission;
