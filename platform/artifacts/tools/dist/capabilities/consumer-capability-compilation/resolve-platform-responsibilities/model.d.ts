import type { CanonicalScenarioGraphEvidence } from "../../../consumer-projection/model/canonical-consumer-capability.js";
import type { PlatformResponsibilityResolutionEvidence } from "../../../consumer-projection/model/platform-responsibility-resolution.js";
import type { ConsumerProjectionTarget, ConsumerSourceAdmissionEvidence } from "../../../consumer-projection/model/consumer-workspace-facts.js";
export interface ResolvePlatformResponsibilitiesInput {
    readonly sourceAdmission: ConsumerSourceAdmissionEvidence;
    readonly graph: CanonicalScenarioGraphEvidence;
    readonly targets: readonly ConsumerProjectionTarget[];
}
export type ResolvePlatformResponsibilitiesEvidence = PlatformResponsibilityResolutionEvidence;
export declare function isResolvePlatformResponsibilitiesInput(value: unknown): value is ResolvePlatformResponsibilitiesInput;
export declare function isResolvePlatformResponsibilitiesEvidence(value: unknown): value is ResolvePlatformResponsibilitiesEvidence;
