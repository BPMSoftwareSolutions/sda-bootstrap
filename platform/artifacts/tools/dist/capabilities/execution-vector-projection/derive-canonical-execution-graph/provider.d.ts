import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { DeriveCanonicalExecutionGraphEvidence, DeriveCanonicalExecutionGraphInput } from "./model.js";
export declare class DeriveCanonicalExecutionGraphProvider implements ResponsibilityProvider<DeriveCanonicalExecutionGraphInput, DeriveCanonicalExecutionGraphEvidence> {
    readonly responsibilityId = "resolve-canonical-execution-vector-meaning";
    execute(input: DeriveCanonicalExecutionGraphInput): Promise<DeriveCanonicalExecutionGraphEvidence>;
}
