import type { RealizationProjectionPlan } from "../../capabilities/realization-planning/construct-deterministic-realization-plan/model.js";
import { type RealizationProjectorProfile } from "../../model/realization-planning-adapter-profile.js";
import type { RealizationProjectionPlanningInput, RealizationProjectorPort } from "../../ports/realization-planning/realization-projector.js";
export declare class ProfiledDigestRealizationProjector implements RealizationProjectorPort {
    private readonly profile;
    private readonly projector;
    constructor(profile: RealizationProjectorProfile);
    planProjection(input: RealizationProjectionPlanningInput): Promise<RealizationProjectionPlan>;
}
