import type { ExecutionObserver, ExecutionStepObservation } from "../../src/execution/index.js";
/**
 * Records every observation emitted by a ScenarioKernel run, in emission
 * order, for tests to inspect — the same shape a real telemetry sink would
 * receive, just held in memory instead of written anywhere.
 */
export declare class InMemoryExecutionObserver implements ExecutionObserver {
    readonly observations: ExecutionStepObservation[];
    observe(observation: ExecutionStepObservation): void;
}
