import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { DeriveTargetExecutionGraphEvidence, DeriveTargetExecutionGraphInput } from "./model.js";
export declare class DeriveTargetExecutionGraphProvider implements ResponsibilityProvider<DeriveTargetExecutionGraphInput, DeriveTargetExecutionGraphEvidence> {
    readonly responsibilityId = "apply-target-execution-mechanics";
    execute(input: DeriveTargetExecutionGraphInput): Promise<DeriveTargetExecutionGraphEvidence>;
}
