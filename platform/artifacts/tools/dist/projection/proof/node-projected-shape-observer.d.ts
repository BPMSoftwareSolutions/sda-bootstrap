import type { ProjectionPlan } from "../model/projection-plan.js";
import type { ShapeEvidence } from "../model/shape-evidence.js";
import type { AdmittedProjectionFile, ProjectedShapeObserver } from "./projected-shape-observer.js";
export declare class NodeProjectedShapeObserver implements ProjectedShapeObserver {
    readonly target: "node";
    observe(admittedFiles: readonly AdmittedProjectionFile[], plan: ProjectionPlan): ShapeEvidence;
}
