import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { DeterminePlatformMechanicConformanceEvidence, DeterminePlatformMechanicConformanceInput } from "./model.js";
export declare class DeterminePlatformMechanicConformanceProvider implements ResponsibilityProvider<DeterminePlatformMechanicConformanceInput, DeterminePlatformMechanicConformanceEvidence> {
    readonly responsibilityId = "evaluate-current-platform-mechanic-proofs";
    execute(input: DeterminePlatformMechanicConformanceInput): Promise<DeterminePlatformMechanicConformanceEvidence>;
}
