import type { ContractReference, ObligationDisposition, ScenarioV2 } from "../model/semantic-model.js";
export interface ResponsibilityProvider<TInput, TEvidence> {
    readonly responsibilityId: string;
    execute(input: TInput, signal?: AbortSignal): Promise<TEvidence>;
}
export interface ObligationEvaluator<TEvidence> {
    readonly obligationId: string;
    evaluate(evidence: TEvidence): ObligationDisposition;
}
export interface ContractAdmissionPort {
    admit(contract: ContractReference, value: unknown): Promise<unknown>;
}
export interface ExecutionObservation {
    readonly observationType: "scenario-execution-observation.v1";
    readonly executionId: string;
    readonly rootExecutionId: string;
    readonly parentExecutionId: string | null;
    readonly scenarioId: string;
    readonly stepId: string;
    readonly sequence: number;
    readonly status: "observed" | "admission-rejected" | "execution-failed";
    readonly observedAt: string;
}
export interface ExecutionObservationPort {
    observe(observation: ExecutionObservation): void;
}
export interface KernelExecution<TEvidence> {
    readonly executionId: string;
    readonly scenarioId: string;
    readonly outcome: TEvidence | null;
    readonly disposition: "completed" | "terminated" | "rejected" | "failed";
}
export interface AtomicScenarioRunner {
    run<TInput, TEvidence>(options: {
        readonly scenario: ScenarioV2;
        readonly input: TInput;
        readonly provider: ResponsibilityProvider<TInput, TEvidence>;
        readonly contracts: ContractAdmissionPort;
        readonly observer: ExecutionObservationPort;
        readonly executionId: string;
        readonly rootExecutionId: string;
        readonly signal?: AbortSignal;
    }): Promise<KernelExecution<TEvidence>>;
}
