import type { AnnotatedGherkinScenario, GherkinParser } from "../../ports/consumer-projection/gherkin-parser.js";
export declare class AnnotatedGherkinParser implements GherkinParser {
    parse(source: string): readonly AnnotatedGherkinScenario[];
}
export declare function parseAnnotatedGherkin(source: string): readonly AnnotatedGherkinScenario[];
