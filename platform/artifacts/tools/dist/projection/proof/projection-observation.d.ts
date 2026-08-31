import type { ProjectionTarget } from "../model/projection-profile.js";
import type { ToolchainResult } from "../toolchain/target-toolchain.js";
export declare function discoverProjectionTargets(repositoryRoot: string): readonly ProjectionTarget[];
/** Compatibility surface for repository-local commands; the values are registry-derived. */
export declare const projectionTargets: readonly ProjectionTarget[];
export type ProjectionDisposition = "SATISFIED" | "NOT_SATISFIED" | "NOT_OBSERVABLE";
export interface StructuralProjectionObservation {
    readonly projectionConformanceType: "scenario-kernel-projection-conformance.v1";
    readonly language: ProjectionTarget;
    readonly implementationId: string;
    readonly observedAt: string;
    readonly profilePath: string;
    readonly disposition: ProjectionDisposition;
    readonly generation: {
        readonly typesGenerated: number;
        readonly outputDirectory: string;
    };
    readonly toolchainValidation: ToolchainResult;
    readonly structuralComparison: {
        readonly totalTypes: number;
        readonly matched: number;
        readonly mismatched: readonly {
            readonly typeName: string;
            readonly detail: string;
        }[];
        readonly handWrittenOnly: readonly string[];
        readonly generatedOnly: readonly string[];
    };
    readonly conforming: boolean;
}
export interface ExecutionProjectionObservation {
    readonly executionVectorProjectionConformanceType: "scenario-kernel-execution-vector-projection-conformance.v1";
    readonly language: ProjectionTarget;
    readonly observedAt: string;
    readonly disposition: ProjectionDisposition;
    readonly toolchainValidation: ToolchainResult;
    readonly behavioralValidation: ToolchainResult & {
        readonly totalFixtures: number;
    };
    readonly conforming: boolean;
}
