import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { CandidateOriginEvidence, DetermineCandidateOriginInput } from "./model.js";
export declare class DetermineCandidateOriginProvider implements ResponsibilityProvider<DetermineCandidateOriginInput, CandidateOriginEvidence> {
    readonly responsibilityId = "derive-candidate-source-origin";
    execute(input: DetermineCandidateOriginInput): Promise<CandidateOriginEvidence>;
}
