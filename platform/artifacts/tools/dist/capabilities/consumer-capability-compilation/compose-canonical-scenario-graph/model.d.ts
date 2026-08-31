import type { CanonicalScenarioGraphEvidence } from "../../../consumer-projection/model/canonical-consumer-capability.js";
import type { ConsumerSourceAdmissionEvidence } from "../../../consumer-projection/model/consumer-workspace-facts.js";
export interface ComposeCanonicalScenarioGraphInput {
    readonly sourceAdmission: ConsumerSourceAdmissionEvidence;
}
export type ComposeCanonicalScenarioGraphEvidence = CanonicalScenarioGraphEvidence;
export declare function isComposeCanonicalScenarioGraphInput(value: unknown): value is ComposeCanonicalScenarioGraphInput;
export declare function isComposeCanonicalScenarioGraphEvidence(value: unknown): value is ComposeCanonicalScenarioGraphEvidence;
