import type { ConsumerSourceObservationAdmission, ConsumerSourceObservationProvider, ConsumerSourceObservationRequest, ConsumerSourceObservationResolution } from "../../ports/consumer-projection/consumer-source-observation-provider.js";
export declare class NodeTextSourceObservationProvider implements ConsumerSourceObservationProvider {
    readonly providerId = "sda-node-text-source-observation.v1";
    admit(sourceValue: unknown): ConsumerSourceObservationAdmission;
    observe(request: ConsumerSourceObservationRequest): Promise<ConsumerSourceObservationResolution>;
}
