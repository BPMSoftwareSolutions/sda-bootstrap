function tag(scenario, name) {
    const value = scenario.tags[name];
    if (typeof value !== "string")
        throw new Error(`Scenario '${scenario.name}' has no value for @${name}.`);
    return value;
}
export function projectScenario(parsed) {
    const scenarioId = tag(parsed, "scenario");
    const outcome = {
        outcomeId: tag(parsed, "outcome"),
        contract: { contractId: tag(parsed, "outcome-contract") },
        experience: { statement: parsed.then },
        ...(parsed.tags["outcome-terminal"] === true ? { terminal: true } : {})
    };
    return {
        scenarioId,
        input: { inputId: tag(parsed, "input"), contract: { contractId: tag(parsed, "input-contract") } },
        event: { eventId: tag(parsed, "event"), executionAuthorityId: tag(parsed, "event-authority") },
        outcome,
        gherkin: {
            given: { semanticRef: `${scenarioId}.given`, text: parsed.given },
            when: { semanticRef: `${scenarioId}.when`, text: parsed.when },
            then: { semanticRef: `${scenarioId}.then`, text: parsed.then }
        },
        ...(parsed.name ? { name: parsed.name } : {})
    };
}
export class GherkinScenarioGraphBuilder {
    parser;
    constructor(parser) {
        this.parser = parser;
    }
    build(source) {
        return Object.freeze(this.parser.parse(source).map(projectScenario));
    }
}
