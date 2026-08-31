import type { AnnotatedGherkinScenario, GherkinParser } from "../../ports/consumer-projection/gherkin-parser.js";
import type { ProjectedConsumerScenario } from "../model/canonical-consumer-capability.js";
export declare function projectScenario(parsed: AnnotatedGherkinScenario): ProjectedConsumerScenario;
export declare class GherkinScenarioGraphBuilder {
    private readonly parser;
    constructor(parser: GherkinParser);
    build(source: string): readonly ProjectedConsumerScenario[];
}
