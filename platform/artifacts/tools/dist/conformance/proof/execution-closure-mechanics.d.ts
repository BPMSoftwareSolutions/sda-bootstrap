export interface ScenarioExecutionObservation {
    readonly executionId: string;
    readonly rootExecutionId: string;
    readonly parentExecutionId?: string | null;
    readonly scenarioId: string;
    readonly stepId: string;
    readonly sequence: number;
    readonly status: string;
}
export interface ExecutionClosureVerdict {
    readonly executionClosureType: "scenario-kernel-execution-closure.v1";
    readonly executionId: string;
    readonly conforming: boolean;
    readonly observedSteps: readonly string[];
    readonly expectedSteps: readonly string[];
    readonly reason?: string;
}
export declare function evaluateExecutionClosureTrace(observations: readonly ScenarioExecutionObservation[], canonicalSteps: readonly string[]): ExecutionClosureVerdict;
