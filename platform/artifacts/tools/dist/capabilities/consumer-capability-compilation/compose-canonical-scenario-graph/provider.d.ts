import type { GherkinParser } from "../../../ports/consumer-projection/gherkin-parser.js";
import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { ComposeCanonicalScenarioGraphEvidence, ComposeCanonicalScenarioGraphInput } from "./model.js";
export declare class ComposeCanonicalScenarioGraphProvider implements ResponsibilityProvider<ComposeCanonicalScenarioGraphInput, ComposeCanonicalScenarioGraphEvidence> {
    private readonly parser;
    readonly responsibilityId = "construct-canonical-consumer-capability-graph";
    constructor(parser: GherkinParser);
    execute(input: ComposeCanonicalScenarioGraphInput): Promise<ComposeCanonicalScenarioGraphEvidence>;
}
