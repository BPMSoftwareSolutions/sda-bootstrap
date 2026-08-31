import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ExecutionClosureEvidence, ExecutionClosureInput } from "./model.js";
export declare class ExecutionClosureProvider implements ResponsibilityProvider<ExecutionClosureInput, ExecutionClosureEvidence> {
    readonly responsibilityId = "evaluate-order-lineage-failure-boundary-and-terminal-disposition";
    execute(input: ExecutionClosureInput): Promise<ExecutionClosureEvidence>;
}
