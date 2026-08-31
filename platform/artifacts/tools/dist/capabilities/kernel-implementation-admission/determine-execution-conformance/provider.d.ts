import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ExecutionConformanceEvidence, ExecutionConformanceInput } from "./model.js";
export declare class ExecutionConformanceProvider implements ResponsibilityProvider<ExecutionConformanceInput, ExecutionConformanceEvidence> {
    readonly responsibilityId = "compare-declared-step-embodiments-with-canonical-vector";
    execute(input: ExecutionConformanceInput): Promise<ExecutionConformanceEvidence>;
}
