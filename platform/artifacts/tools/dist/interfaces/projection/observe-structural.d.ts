import type { ProjectionTarget } from "../../projection/model/projection-profile.js";
import { type StructuralProjectionObservation } from "../../projection/proof/projection-observation.js";
export declare const STRUCTURAL_OBSERVATION_PATH: string;
export declare function observeStructuralProjection(repositoryRoot: string, target: ProjectionTarget): StructuralProjectionObservation;
export declare function recordStructuralProjectionObservations(repositoryRoot: string): Readonly<Record<ProjectionTarget, StructuralProjectionObservation>>;
