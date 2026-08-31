import type { ConsumerPlatformObservation, MechanicConformanceFacts } from "../../consumer-projection/model/platform-mechanic-conformance.js";
export declare class NodeConsumerAssuranceRepository {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    loadMechanicConformanceFacts(observations: Readonly<Record<string, ConsumerPlatformObservation>>): MechanicConformanceFacts;
    private bindings;
    private kernelAdmission;
}
