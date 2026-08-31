export interface AnnotatedGherkinScenario {
    readonly name: string;
    readonly tags: Readonly<Record<string, string | true>>;
    readonly given: string;
    readonly when: string;
    readonly then: string;
}
export interface GherkinParser {
    parse(source: string): readonly AnnotatedGherkinScenario[];
}
