import type { Disposition } from "./disposition.js";
import type { ScenarioEvent } from "./scenario-event.js";
export interface ScenarioExecution {
    executionId: string;
    scenarioId: string;
    rootExecutionId: string;
    input: unknown;
    event: ScenarioEvent;
    parentExecutionId?: string | null;
    outcome?: unknown;
    disposition?: Disposition;
}
