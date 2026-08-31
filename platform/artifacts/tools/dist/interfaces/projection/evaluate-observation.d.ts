import type { ProjectionTarget } from "../../projection/model/projection-profile.js";
import type { ExecutionProjectionObservation, StructuralProjectionObservation } from "../../projection/proof/projection-observation.js";
export type ProjectionEvaluation<T> = {
    readonly language: ProjectionTarget;
    readonly observed: true;
    readonly conforming: boolean;
    readonly result: T;
} | {
    readonly language: ProjectionTarget;
    readonly observed: false;
    readonly conforming: false;
    readonly reason: string;
};
export declare function evaluateStructuralProjection(repositoryRoot: string, language: ProjectionTarget): ProjectionEvaluation<StructuralProjectionObservation>;
export declare function evaluateExecutionProjection(repositoryRoot: string, language: ProjectionTarget): ProjectionEvaluation<ExecutionProjectionObservation>;
