import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import { type RealizationLifecycleFixture } from "../../../model/realization-lifecycle.js";
import type { RealizationLifecycleContractEvidence } from "./model.js";
export declare class VerifyRealizationLifecycleContractsProvider implements ResponsibilityProvider<RealizationLifecycleFixture, RealizationLifecycleContractEvidence> {
    readonly responsibilityId = "verify-content-addressed-realization-lifecycle-contracts";
    execute(fixture: RealizationLifecycleFixture): Promise<RealizationLifecycleContractEvidence>;
}
