import type { ConsumerSemanticReadModelAuthorityAdmissionRequest, ConsumerSemanticReadModelProvider, ConsumerSemanticReadModelRequest, ConsumerSemanticReadModelResolution } from "../../ports/consumer-projection/consumer-semantic-read-model-provider.js";
import type { ConsumerSourceObservationProvider } from "../../ports/consumer-projection/consumer-source-observation-provider.js";
export declare class NodeAuthorityTransformationSemanticReadModelProvider implements ConsumerSemanticReadModelProvider {
    private readonly repositoryRoot;
    readonly providerId = "sda-node-authority-transformation-semantic-read-model.v1";
    readonly authorityTypes: readonly string[];
    private platformModule?;
    private readonly sourceObservationProviders;
    constructor(repositoryRoot: string, sourceObservationProviders?: readonly ConsumerSourceObservationProvider[]);
    admit(request: ConsumerSemanticReadModelAuthorityAdmissionRequest): void;
    private platform;
    private observeSources;
    resolve(request: ConsumerSemanticReadModelRequest): Promise<ConsumerSemanticReadModelResolution>;
}
