import type { PromotionEvidence } from "../../capabilities/projected-implementation-promotion/promote-proven-implementation/model.js";
import type { ObligationDisposition } from "../../model/semantic-model.js";
import type { ProjectionTarget } from "../../projection/model/projection-profile.js";
export interface ProvenProjectionPromotionResult {
    readonly evidence: PromotionEvidence;
    readonly disposition: ObligationDisposition;
}
export declare function promoteProvenProjection(options: {
    readonly repositoryRoot: string;
    readonly target: ProjectionTarget;
    readonly plane: "structural" | "execution";
}): Promise<ProvenProjectionPromotionResult>;
