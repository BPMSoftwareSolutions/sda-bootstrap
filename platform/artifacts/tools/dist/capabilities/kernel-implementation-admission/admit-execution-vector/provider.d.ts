import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ExecutionVectorAdmissionEvidence, ExecutionVectorAdmissionInput } from "./model.js";
export declare class ExecutionVectorAdmissionProvider implements ResponsibilityProvider<ExecutionVectorAdmissionInput, ExecutionVectorAdmissionEvidence> {
    readonly responsibilityId = "validate-canonical-execution-circuit";
    execute(input: ExecutionVectorAdmissionInput): Promise<ExecutionVectorAdmissionEvidence>;
}
