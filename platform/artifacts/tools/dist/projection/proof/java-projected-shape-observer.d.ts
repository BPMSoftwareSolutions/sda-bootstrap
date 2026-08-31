import type { ProjectionPlan } from "../model/projection-plan.js";
import type { ShapeEvidence } from "../model/shape-evidence.js";
import type { AdmittedProjectionFile, ProjectedShapeObserver } from "./projected-shape-observer.js";
export declare class JavaProjectedShapeObserver implements ProjectedShapeObserver {
    readonly target: "java";
    observe(admittedFiles: readonly AdmittedProjectionFile[], plan: ProjectionPlan): ShapeEvidence;
}
