import type { ContractReference } from "./contract-reference.js";
import type { ScenarioOutcomeExperience } from "./scenario-outcome-experience.js";
export interface ScenarioOutcome {
    outcomeId: string;
    contract: ContractReference;
    experience?: ScenarioOutcomeExperience;
    semanticType?: string;
    terminal?: boolean;
}
