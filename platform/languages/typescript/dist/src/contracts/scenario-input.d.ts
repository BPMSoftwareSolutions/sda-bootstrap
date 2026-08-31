import type { ContractReference } from "./contract-reference.js";
export interface ScenarioInput {
    inputId: string;
    contract: ContractReference;
    semanticType?: string;
}
