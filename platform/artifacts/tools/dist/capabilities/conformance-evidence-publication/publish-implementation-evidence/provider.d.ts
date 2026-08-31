import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { PublishImplementationEvidenceEvidence, PublishImplementationEvidenceInput } from "./model.js";
export declare class PublishImplementationEvidenceProvider implements ResponsibilityProvider<PublishImplementationEvidenceInput, PublishImplementationEvidenceEvidence> {
    readonly responsibilityId = "construct-versioned-implementation-evidence-artifact";
    execute(input: PublishImplementationEvidenceInput): Promise<PublishImplementationEvidenceEvidence>;
}
