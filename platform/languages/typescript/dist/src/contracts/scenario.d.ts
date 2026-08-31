import type { GherkinBinding } from "./gherkin-binding.js";
import type { ScenarioEvent } from "./scenario-event.js";
import type { ScenarioInput } from "./scenario-input.js";
import type { ScenarioOutcome } from "./scenario-outcome.js";
export interface Scenario {
    scenarioId: string;
    input: ScenarioInput;
    event: ScenarioEvent;
    outcome: ScenarioOutcome;
    name?: string;
    description?: string;
    gherkin?: GherkinBinding;
}
