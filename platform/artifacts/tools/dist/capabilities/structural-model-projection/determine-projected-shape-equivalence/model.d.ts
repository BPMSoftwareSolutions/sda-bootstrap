import type { SourceFact } from "../../../model/semantic-model.js";
import type { ProjectionPlan } from "../../../projection/model/projection-plan.js";
import type { ShapeEvidence } from "../../../projection/model/shape-evidence.js";
export interface AdmittedSourceFile {
    readonly path: string;
    readonly content: string;
}
export interface DetermineShapeEquivalenceInput {
    readonly plan: ProjectionPlan;
    readonly admittedSource: SourceFact<readonly AdmittedSourceFile[]>;
}
export type DetermineShapeEquivalenceEvidence = ShapeEvidence;
export declare function isDetermineShapeEquivalenceInput(value: unknown): value is DetermineShapeEquivalenceInput;
export declare function isDetermineShapeEquivalenceEvidence(value: unknown): value is DetermineShapeEquivalenceEvidence;
