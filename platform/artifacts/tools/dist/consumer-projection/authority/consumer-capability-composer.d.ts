import type { CanonicalConsumerCapability, ProjectedConsumerScenario, ProjectedConsumerTransition } from "../model/canonical-consumer-capability.js";
import type { JsonRecord } from "../model/consumer-workspace-facts.js";
export declare const CONSUMER_CAPABILITY_TYPE: "scenario-driven-capability.v1";
export declare class ConsumerCapabilityComposer {
    compose(authority: JsonRecord, scenarios: readonly ProjectedConsumerScenario[], transitions: readonly ProjectedConsumerTransition[], semanticGraphAuthority?: JsonRecord): CanonicalConsumerCapability;
}
export declare function composeCapability(authority: JsonRecord, scenarios: readonly ProjectedConsumerScenario[], transitions?: readonly ProjectedConsumerTransition[]): CanonicalConsumerCapability;
