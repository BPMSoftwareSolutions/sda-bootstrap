import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { PromoteProvenImplementationInput, PromotionEvidence } from "./model.js";
export declare class PromoteProvenImplementationProvider implements ResponsibilityProvider<PromoteProvenImplementationInput, PromotionEvidence> {
    readonly responsibilityId = "evaluate-transactional-projection-publication";
    execute(input: PromoteProvenImplementationInput): Promise<PromotionEvidence>;
}
