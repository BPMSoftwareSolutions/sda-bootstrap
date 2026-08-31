import type { ExecutionObservation, ExecutionObservationPort } from "../../ports/capability-ports.js";
export declare class InMemoryExecutionObserver implements ExecutionObservationPort {
    readonly observations: ExecutionObservation[];
    observe(observation: ExecutionObservation): void;
}
