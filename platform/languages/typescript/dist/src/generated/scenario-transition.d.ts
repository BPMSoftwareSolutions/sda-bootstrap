import type { ScenarioTransitionFrom } from "./scenario-transition-from.js";
import type { ScenarioTransitionTo } from "./scenario-transition-to.js";
import type { SemanticProgress } from "./semantic-progress.js";
export interface ScenarioTransition {
    transitionId: string;
    from: ScenarioTransitionFrom;
    to: ScenarioTransitionTo;
    semanticProgress: SemanticProgress;
    bindingAuthorityId?: string;
}
