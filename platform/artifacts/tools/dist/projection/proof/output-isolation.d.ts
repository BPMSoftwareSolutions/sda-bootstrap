import type { StructuralProjectionProfile } from "../model/projection-profile.js";
export interface OutputIsolationConflict {
    readonly a: string;
    readonly b: string;
    readonly reason: string;
}
export declare function outputsOverlap(a: string, b: string): boolean;
export declare function validateOutputIsolation(profile: StructuralProjectionProfile): readonly OutputIsolationConflict[];
