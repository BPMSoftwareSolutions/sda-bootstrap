import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ProveCrossTargetProjectionEquivalenceEvidence, ProveCrossTargetProjectionEquivalenceInput } from "./model.js";
export declare class ProveCrossTargetProjectionEquivalenceProvider implements ResponsibilityProvider<ProveCrossTargetProjectionEquivalenceInput, ProveCrossTargetProjectionEquivalenceEvidence> {
    readonly responsibilityId = "compare-consumer-outcomes-across-projected-runtimes";
    execute(input: ProveCrossTargetProjectionEquivalenceInput): Promise<ProveCrossTargetProjectionEquivalenceEvidence>;
}
