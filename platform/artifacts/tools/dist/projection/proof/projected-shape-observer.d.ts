import type { ProjectionPlan } from "../model/projection-plan.js";
import type { ProjectionTarget } from "../model/projection-profile.js";
import type { ShapeEvidence } from "../model/shape-evidence.js";
export interface AdmittedProjectionFile {
    readonly path?: string;
    readonly content: string;
}
export interface ProjectedShapeObserver {
    readonly target: ProjectionTarget;
    observe(admittedFiles: readonly AdmittedProjectionFile[], plan: ProjectionPlan): ShapeEvidence;
}
