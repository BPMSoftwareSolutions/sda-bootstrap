import type { ProjectionPlan } from "../model/projection-plan.js";
import type { ShapeEvidence } from "../model/shape-evidence.js";
import type { AdmittedProjectionFile, ProjectedShapeObserver } from "./projected-shape-observer.js";
export declare class CSharpProjectedShapeObserver implements ProjectedShapeObserver {
    readonly target: "csharp";
    observe(admittedFiles: readonly AdmittedProjectionFile[], plan: ProjectionPlan): ShapeEvidence;
}
