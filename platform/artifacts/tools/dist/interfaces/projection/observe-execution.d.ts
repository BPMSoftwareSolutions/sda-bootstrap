import type { ProjectionTarget } from "../../projection/model/projection-profile.js";
import { type ExecutionProjectionObservation } from "../../projection/proof/projection-observation.js";
export declare const EXECUTION_OBSERVATION_PATH: string;
export declare function observeExecutionProjection(repositoryRoot: string, target: ProjectionTarget): ExecutionProjectionObservation;
export declare function recordExecutionProjectionObservations(repositoryRoot: string): Readonly<Record<ProjectionTarget, ExecutionProjectionObservation>>;
