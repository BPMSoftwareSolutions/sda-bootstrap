import { sha256Digest } from "../../enterprise/control-plane/canonical-json.js";
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
export class OnDemandRealizationPolicyDecision {
    async decide(input) {
        const policy = input.realizationPolicy;
        const reasonCodes = [];
        if (policy.activation.mode !== "ON_DEMAND")
            reasonCodes.push("ACTIVATION_MODE_UNSUPPORTED");
        if (policy.retention.idleDisposition !== "EVICT")
            reasonCodes.push("IDLE_DISPOSITION_UNSUPPORTED");
        if (policy.capacity.minimumWarmInstances !== 0 || !policy.capacity.scaleToZero) {
            reasonCodes.push("MINIMUM_WARM_CAPACITY_UNSUPPORTED");
        }
        if (policy.placement.mode !== "PROFILE_RESOLVED")
            reasonCodes.push("PLACEMENT_MODE_UNSUPPORTED");
        if (policy.rehydration.mode !== "AUTOMATIC")
            reasonCodes.push("REHYDRATION_MODE_UNSUPPORTED");
        reasonCodes.sort(compareText);
        const decisionWithoutDigest = {
            decisionType: "sda-realization-policy-decision.v1",
            decisionId: `${input.planId}-${input.targetId}-policy-decision`,
            targetId: input.targetId,
            registrationDigest: input.capabilityRegistration.registrationDigest,
            realizationPolicyId: policy.policyId,
            realizationPolicyDigest: policy.policyDigest,
            environmentProfileId: input.environmentProfile.profileId,
            environmentProfileDigest: input.environmentProfile.profileDigest,
            policySnapshotDigest: input.policySnapshotDigest,
            disposition: reasonCodes.length === 0 ? "PERMITTED" : "DENIED",
            activationMode: policy.activation.mode,
            placementMode: policy.placement.mode,
            idleDisposition: policy.retention.idleDisposition,
            reasonCodes,
            evaluatorId: "typescript-on-demand-realization-policy-decision.v1",
            evaluatorDigest: input.policySnapshotDigest
        };
        return Object.freeze({
            ...decisionWithoutDigest,
            reasonCodes: Object.freeze([...reasonCodes]),
            decisionDigest: sha256Digest(decisionWithoutDigest)
        });
    }
}
