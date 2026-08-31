import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
export type ConsumerSourceObservationAdmission = {
    readonly disposition: "NOT_APPLICABLE";
} | {
    readonly disposition: "SUPPORTED";
    readonly sourceType: string;
    readonly mediaType: string;
} | {
    readonly disposition: "UNSUPPORTED";
    readonly sourceType: string;
    readonly mediaType?: string;
    readonly code: string;
    readonly reason: string;
};
export interface ConsumerSourceObservationRequest {
    readonly sourceRole: string;
    readonly sourceValue: unknown;
}
export interface ConsumerSourceObservationResolution {
    readonly disposition: "OBSERVED";
    readonly observation: JsonRecord;
    readonly evidence: JsonRecord;
}
export interface ConsumerSourceObservationProvider {
    readonly providerId: string;
    admit(sourceValue: unknown): ConsumerSourceObservationAdmission;
    observe(request: ConsumerSourceObservationRequest): Promise<ConsumerSourceObservationResolution>;
}
