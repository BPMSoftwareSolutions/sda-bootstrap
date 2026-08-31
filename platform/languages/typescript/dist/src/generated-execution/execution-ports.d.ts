import type { Scenario, ScenarioEvent, ContractReference } from "../contracts/index.js";
export { ContractAdmissionException } from "../execution/index.js";
export interface ExecuteOptions {
    executionId: string;
    rootExecutionId: string;
    input: unknown;
    parentExecutionId?: string | null;
    signal?: AbortSignal;
}
export declare function isAbortError(error: unknown): boolean;
/** The resolved target of a ScenarioEvent's executionAuthorityId. */
export interface ExecutionAuthority {
    executionAuthorityId: string;
    handler: unknown;
}
/** Embodies both admit-input and admit-outcome from the canonical execution vector. */
export interface ContractValidator {
    admit(contract: ContractReference, value: unknown, signal?: AbortSignal): Promise<unknown>;
}
/** Embodies resolve-event-authority from the canonical execution vector. */
export interface ExecutionAuthorityResolver {
    resolve(scenarioEvent: ScenarioEvent, signal?: AbortSignal): Promise<ExecutionAuthority>;
}
/** Embodies execute-event-authority from the canonical execution vector. */
export interface SemanticExecutor {
    execute(authority: ExecutionAuthority, admittedInput: unknown, signal?: AbortSignal): Promise<unknown>;
}
/** Embodies the happy-path half of resolve-disposition. */
export interface DispositionResolver {
    resolve(scenario: Scenario, admittedOutcome: unknown): string;
}
/** Runtime testimony for one canonical execution-vector step — see kernel/schemas/scenario-execution-observation.schema.json. */
export type ExecutionObservationStatus = "observed" | "admission-rejected" | "execution-failed";
export interface ExecutionClock {
    now(): string;
}
export interface ExecutionStepObservation {
    observationType: "scenario-execution-observation.v1";
    executionId: string;
    rootExecutionId: string;
    parentExecutionId: string | null;
    scenarioId: string;
    stepId: string;
    sequence: number;
    status: ExecutionObservationStatus;
    observedAt: string;
}
/** Embodies execution testimony for every canonical execution-vector step (governance rules K011-K013). */
export interface ExecutionObserver {
    observe(observation: ExecutionStepObservation): void;
}
