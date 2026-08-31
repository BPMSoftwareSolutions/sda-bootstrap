/**
 * Runtime testimony for one canonical execution-vector step — see
 * kernel/schemas/scenario-execution-observation.schema.json. The kernel
 * constructs and emits these itself as it performs each step; nothing
 * upstream of ExecutionObserver.observe ever hand-assembles one.
 */
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
/**
 * Embodies execution testimony for every canonical execution-vector step
 * (see governance rules K011-K013). A no-op ExecutionObserver is a
 * legitimate implementation choice for a consumer that doesn't want
 * telemetry recorded anywhere — but the kernel always calls it, so the
 * choice to discard testimony is explicit at the adapter, never a gap in
 * the kernel body.
 */
export interface ExecutionObserver {
    observe(observation: ExecutionStepObservation): void;
}
