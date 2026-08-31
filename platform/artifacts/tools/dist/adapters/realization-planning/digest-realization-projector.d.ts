import type { RealizationProjectionPlan } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import type { RealizationProjectionPlanningInput, RealizationProjectorPort } from "../../ports/realization-planning/realization-projector.js";
export declare class DigestRealizationProjector implements RealizationProjectorPort {
    planProjection(input: RealizationProjectionPlanningInput): Promise<RealizationProjectionPlan>;
}
