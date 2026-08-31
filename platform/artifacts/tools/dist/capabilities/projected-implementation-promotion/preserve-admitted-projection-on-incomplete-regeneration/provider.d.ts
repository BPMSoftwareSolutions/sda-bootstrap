import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { PreservationEvidence, PreserveAdmittedProjectionInput } from "./model.js";
export declare class PreserveAdmittedProjectionProvider implements ResponsibilityProvider<PreserveAdmittedProjectionInput, PreservationEvidence> {
    readonly responsibilityId = "verify-admitted-bytes-survive-incomplete-regeneration";
    execute(input: PreserveAdmittedProjectionInput): Promise<PreservationEvidence>;
}
