import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { DeriveTargetProjectionGraphEvidence, DeriveTargetProjectionGraphInput } from "./model.js";
export declare class DeriveTargetProjectionGraphProvider implements ResponsibilityProvider<DeriveTargetProjectionGraphInput, DeriveTargetProjectionGraphEvidence> {
    readonly responsibilityId = "apply-target-structural-projection-policy";
    execute(input: DeriveTargetProjectionGraphInput): Promise<DeriveTargetProjectionGraphEvidence>;
}
