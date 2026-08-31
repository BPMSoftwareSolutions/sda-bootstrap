import type { ConsumerSourceAdmissionEvidence, ConsumerWorkspaceFacts } from "../../../consumer-projection/model/consumer-workspace-facts.js";
export interface AdmitConsumerSourceFactsInput {
    readonly facts: ConsumerWorkspaceFacts;
}
export type AdmitConsumerSourceFactsEvidence = ConsumerSourceAdmissionEvidence;
export declare function isAdmitConsumerSourceFactsInput(value: unknown): value is AdmitConsumerSourceFactsInput;
export declare function isAdmitConsumerSourceFactsEvidence(value: unknown): value is AdmitConsumerSourceFactsEvidence;
