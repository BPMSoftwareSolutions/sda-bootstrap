import type { ProjectedConsumerScenario, ProjectedConsumerTransition } from "../model/canonical-consumer-capability.js";
import type { JsonRecord } from "../model/consumer-workspace-facts.js";
export declare class SemanticTransitionGraphBuilder {
    build(authority: JsonRecord, projectedScenariosById: Readonly<Record<string, ProjectedConsumerScenario>>): readonly ProjectedConsumerTransition[];
}
export declare function projectTransitionsFromSemanticGraph(authority: JsonRecord, projectedScenariosById: Readonly<Record<string, ProjectedConsumerScenario>>): readonly ProjectedConsumerTransition[];
