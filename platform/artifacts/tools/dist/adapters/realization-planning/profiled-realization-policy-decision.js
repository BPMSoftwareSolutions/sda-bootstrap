import { sha256Digest } from "../../enterprise/control-plane/canonical-json.js";
import { cloneFrozenProfile, digestAdapterProfile } from "../../model/realization-planning-adapter-profile.js";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
export class ProfiledRealizationPolicyDecision {
    profile;
    constructor(profile) {
        if (!DIGEST_PATTERN.test(profile.rulesAuthorityDigest) ||
            profile.profileDigest !== digestAdapterProfile(profile)) {
            throw new Error(`Policy-decision profile '${profile.profileId}' failed digest verification.`);
        }
        this.profile = cloneFrozenProfile(profile);
    }
    async decide(input) {
        if (input.policySnapshotDigest !== this.profile.rulesAuthorityDigest) {
            throw new Error("Policy rules authority does not match the pinned planning snapshot.");
        }
        const policy = input.realizationPolicy;
        const reasons = [];
        if (!this.profile.supportedActivationModes.includes(policy.activation.mode))
            reasons.push("ACTIVATION_MODE_UNSUPPORTED");
        if (!this.profile.supportedIdleDispositions.includes(policy.retention.idleDisposition))
            reasons.push("IDLE_DISPOSITION_UNSUPPORTED");
        if (policy.capacity.minimumWarmInstances > this.profile.maximumMinimumWarmInstances ||
            (this.profile.requireScaleToZero && !policy.capacity.scaleToZero)) {
            reasons.push("MINIMUM_WARM_CAPACITY_UNSUPPORTED");
        }
        if (!this.profile.supportedPlacementModes.includes(policy.placement.mode))
            reasons.push("PLACEMENT_MODE_UNSUPPORTED");
        if (!this.profile.supportedRehydrationModes.includes(policy.rehydration.mode))
            reasons.push("REHYDRATION_MODE_UNSUPPORTED");
        if (!this.profile.supportedEnvironmentClasses.includes(input.environmentProfile.environmentClass)) {
            reasons.push("ENVIRONMENT_CLASS_UNSUPPORTED");
        }
        reasons.sort(compareText);
        const withoutDigest = {
            decisionType: "sda-realization-policy-decision.v1",
            decisionId: `${input.planId}-${input.targetId}-policy-decision`,
            targetId: input.targetId,
            registrationDigest: input.capabilityRegistration.registrationDigest,
            realizationPolicyId: policy.policyId,
            realizationPolicyDigest: policy.policyDigest,
            environmentProfileId: input.environmentProfile.profileId,
            environmentProfileDigest: input.environmentProfile.profileDigest,
            policySnapshotDigest: input.policySnapshotDigest,
            disposition: reasons.length === 0 ? "PERMITTED" : "DENIED",
            activationMode: policy.activation.mode,
            placementMode: policy.placement.mode,
            idleDisposition: policy.retention.idleDisposition,
            reasonCodes: reasons,
            evaluatorId: this.profile.evaluatorId,
            evaluatorDigest: this.profile.profileDigest
        };
        return Object.freeze({
            ...withoutDigest,
            reasonCodes: Object.freeze([...reasons]),
            decisionDigest: sha256Digest(withoutDigest)
        });
    }
}
