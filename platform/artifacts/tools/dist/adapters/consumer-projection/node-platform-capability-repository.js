import fs from "node:fs";
import path from "node:path";
export class NodePlatformCapabilityRepository {
    repositoryRoot;
    proofProfile;
    constructor(repositoryRoot, proofProfile) {
        this.repositoryRoot = repositoryRoot;
        this.proofProfile = proofProfile;
    }
    resolve(requirement, target, catalog) {
        const proofBinding = requirement.requestedCapabilityId
            ? this.proofProfile?.bindings.find((item) => item.target === target &&
                item.requestedCapabilityId === requirement.requestedCapabilityId)
            : undefined;
        const requestedCapabilityId = proofBinding?.providerCapabilityId ?? requirement.requestedCapabilityId;
        const capability = requestedCapabilityId
            ? catalog.capabilities.find((item) => item.capabilityId === requestedCapabilityId && item.projectionTarget === target)
            : catalog.capabilities.find((item) => item.projectionTarget === target && item.kind === requirement.capabilityKind && item.providesMechanics.includes(requirement.mechanicId));
        if (!capability)
            return null;
        if (!fs.existsSync(path.join(this.repositoryRoot, capability.implementationRef)) ||
            !fs.existsSync(path.join(this.repositoryRoot, capability.conformanceRef))) {
            return "IMPLEMENTATION_EVIDENCE_MISSING";
        }
        return capability;
    }
}
