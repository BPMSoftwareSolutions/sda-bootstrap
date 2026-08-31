import type { LanguageMechanicProfileResolution, MechanicConformanceFacts } from "../../../consumer-projection/model/platform-mechanic-conformance.js";
export type DeterminePlatformMechanicConformanceInput = MechanicConformanceFacts;
export type DeterminePlatformMechanicConformanceEvidence = LanguageMechanicProfileResolution;
export declare function isDeterminePlatformMechanicConformanceInput(value: unknown): value is DeterminePlatformMechanicConformanceInput;
export declare function isDeterminePlatformMechanicConformanceEvidence(value: unknown): value is DeterminePlatformMechanicConformanceEvidence;
