import type { ProjectionTarget } from "./projection-profile.js";
export interface ProjectionPlanFile {
    readonly relativePath: string;
    readonly content: string;
    readonly digest: string;
    readonly sourcePointers: readonly string[];
}
export interface ProjectionPlan {
    readonly planType: "projection-plan.v1";
    readonly target: ProjectionTarget;
    readonly outputDirectory: string;
    readonly files: readonly ProjectionPlanFile[];
}
