import { sha256Digest } from "../../enterprise/control-plane/canonical-json.js";
function compareText(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function sortedUnique(values) {
    return [...new Set(values)].sort(compareText);
}
export class DigestRealizationProjector {
    async planProjection(input) {
        const actions = [...input.providerBindings]
            .sort((left, right) => compareText(`${left.scenarioId}\u0000${left.responsibilityId}\u0000${left.providerId}`, `${right.scenarioId}\u0000${right.responsibilityId}\u0000${right.providerId}`))
            .map((binding) => {
            const inputDigests = sortedUnique([
                input.capabilityBundleDigest,
                input.interfaceAuthorityDigest,
                ...input.contractDigests,
                input.environmentProfileDigest,
                input.policyDecisionDigest,
                binding.implementationDigest
            ]);
            const artifactId = `${input.targetId}-${binding.responsibilityId}-artifact`;
            return Object.freeze({
                actionType: "PROJECT_PROVIDER_ARTIFACT",
                actionId: `${input.targetId}-${binding.responsibilityId}-projection`,
                scenarioId: binding.scenarioId,
                responsibilityId: binding.responsibilityId,
                providerId: binding.providerId,
                implementationDigest: binding.implementationDigest,
                inputDigests: Object.freeze([...inputDigests]),
                artifact: Object.freeze({
                    artifactId,
                    mediaType: "application/vnd.scenario-driven.realization-provider+json",
                    expectedDigest: sha256Digest({
                        artifactType: "sda-expected-realization-provider-artifact.v1",
                        artifactId,
                        targetId: input.targetId,
                        capabilityId: input.capabilityId,
                        scenarioId: binding.scenarioId,
                        responsibilityId: binding.responsibilityId,
                        providerId: binding.providerId,
                        inputDigests
                    })
                })
            });
        });
        const projectionWithoutDigest = {
            projectionType: "sda-realization-projection-plan.v1",
            projectionId: `${input.planId}-${input.targetId}-projection`,
            targetId: input.targetId,
            environmentProfileId: input.environmentProfileId,
            environmentProfileDigest: input.environmentProfileDigest,
            projectorId: "typescript-digest-realization-projector.v1",
            projectorDigest: input.projectorDigest,
            projectorProfileDigest: input.projectorDigest,
            actions,
        };
        return Object.freeze({
            ...projectionWithoutDigest,
            actions: Object.freeze([...actions]),
            projectionDigest: sha256Digest(projectionWithoutDigest)
        });
    }
}
