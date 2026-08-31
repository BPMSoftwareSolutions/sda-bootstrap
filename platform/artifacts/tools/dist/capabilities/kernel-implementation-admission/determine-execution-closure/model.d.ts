import type { SourceFact } from "../../../model/semantic-model.js";
export interface LanguageExecutionClosureObservation {
    readonly language: string;
    readonly ran: boolean;
    readonly conforming: boolean;
    readonly disposition?: "SATISFIED" | "NOT_SATISFIED" | "NOT_OBSERVABLE";
    readonly reason?: string;
    readonly fixtures?: readonly Record<string, unknown>[];
}
export interface ExecutionClosureInput {
    readonly language: string;
    readonly observationPath: string;
    readonly observation: SourceFact<LanguageExecutionClosureObservation> | null;
}
export interface ExecutionClosureEvidence {
    readonly language: string;
    readonly ran: boolean;
    readonly conforming: boolean;
    readonly reason?: string;
    readonly fixtures?: readonly Record<string, unknown>[];
}
export declare const isExecutionClosureInput: (value: unknown) => value is ExecutionClosureInput;
export declare const isExecutionClosureEvidence: (value: unknown) => value is ExecutionClosureEvidence;
