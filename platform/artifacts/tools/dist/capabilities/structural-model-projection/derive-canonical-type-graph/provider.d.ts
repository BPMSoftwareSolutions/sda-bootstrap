import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { DeriveCanonicalTypeGraphEvidence, DeriveCanonicalTypeGraphInput } from "./model.js";
export declare class DeriveCanonicalTypeGraphProvider implements ResponsibilityProvider<DeriveCanonicalTypeGraphInput, DeriveCanonicalTypeGraphEvidence> {
    readonly responsibilityId = "resolve-schemas-into-target-neutral-type-graph";
    execute(input: DeriveCanonicalTypeGraphInput): Promise<DeriveCanonicalTypeGraphEvidence>;
}
