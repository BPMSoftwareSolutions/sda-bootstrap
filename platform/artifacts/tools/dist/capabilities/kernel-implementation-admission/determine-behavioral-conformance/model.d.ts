import type { SourceFact } from "../../../model/semantic-model.js";
export interface BehavioralObservation {
    readonly language: string;
    readonly toolchainAvailable: boolean;
    readonly ran: boolean;
    readonly conforming: boolean;
    readonly exitCode?: number | null;
    readonly reason?: string;
    readonly summary?: string;
    readonly testsFailed?: number;
    readonly testsPassed?: number;
    readonly testsSkipped?: number;
    readonly testsTotal?: number;
    readonly stderr?: string;
}
export interface BehavioralConformanceInput {
    readonly language: string;
    readonly observationPath: string;
    readonly observation: SourceFact<BehavioralObservation> | null;
}
export type BehavioralConformanceEvidence = BehavioralObservation;
export declare function isBehavioralConformanceEvidence(value: unknown): value is BehavioralConformanceEvidence;
export declare const isBehavioralConformanceInput: (value: unknown) => value is BehavioralConformanceInput;
