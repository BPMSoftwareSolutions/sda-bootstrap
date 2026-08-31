import type { ClockPort } from "../../ports/infrastructure-ports.js";
import type { GovernedPlacementInput } from "../../capabilities/workspace-governance/verify-governed-placement/model.js";
import type { LanguageDeclarationInput } from "../../capabilities/workspace-governance/admit-language-declaration/model.js";
export declare class NodeWorkspaceGovernanceRepository {
    private readonly repositoryRoot;
    private readonly clock;
    private readonly schemas;
    constructor(repositoryRoot: string, clock: ClockPort);
    loadGovernedPlacement(): GovernedPlacementInput;
    loadLanguageDeclaration(language: string): LanguageDeclarationInput;
}
