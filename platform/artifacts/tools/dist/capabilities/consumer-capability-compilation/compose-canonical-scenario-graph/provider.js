import { ConsumerCapabilityComposer } from "../../../consumer-projection/authority/consumer-capability-composer.js";
import { GherkinScenarioGraphBuilder } from "../../../consumer-projection/authority/gherkin-scenario-graph-builder.js";
import { SemanticTransitionGraphBuilder } from "../../../consumer-projection/authority/semantic-transition-graph-builder.js";
export class ComposeCanonicalScenarioGraphProvider {
    parser;
    responsibilityId = "construct-canonical-consumer-capability-graph";
    constructor(parser) {
        this.parser = parser;
    }
    async execute(input) {
        const facts = input.sourceAdmission.facts;
        const scenarios = new GherkinScenarioGraphBuilder(this.parser).build(facts.feature.value);
        const scenariosById = Object.fromEntries(scenarios.map((scenario) => [scenario.scenarioId, scenario]));
        const transitions = new SemanticTransitionGraphBuilder().build(facts.semanticGraph.value, scenariosById);
        const capability = new ConsumerCapabilityComposer().compose(facts.capabilityAuthority.value, scenarios, transitions, facts.semanticGraph.value);
        return Object.freeze({
            evidenceType: "canonical-consumer-scenario-graph-evidence.v1",
            capability,
            scenarios,
            transitions,
            sourceRefs: Object.freeze([facts.feature.sourceRef, facts.semanticGraph.sourceRef, facts.capabilityAuthority.sourceRef])
        });
    }
}
