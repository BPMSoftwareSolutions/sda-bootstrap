import type { JsonRecord } from "./consumer-workspace-facts.js";
export interface ConsumerContractReference {
    readonly contractId: string;
}
export interface ProjectedConsumerScenario extends JsonRecord {
    readonly scenarioId: string;
    readonly input: {
        readonly inputId: string;
        readonly contract: ConsumerContractReference;
    };
    readonly event: {
        readonly eventId: string;
        readonly executionAuthorityId: string;
    };
    readonly outcome: {
        readonly outcomeId: string;
        readonly contract: ConsumerContractReference;
        readonly experience: {
            readonly statement: string;
        };
        readonly terminal?: boolean;
    };
    readonly gherkin: JsonRecord;
}
export interface ProjectedConsumerTransition extends JsonRecord {
    readonly transitionId: string;
    readonly from: {
        readonly scenarioId: string;
        readonly outcomeId: string;
        readonly contractId: string;
    };
    readonly to: {
        readonly scenarioId: string;
        readonly inputId: string;
        readonly contractId: string;
    };
    readonly semanticProgress: string;
    readonly bindingAuthorityId?: string;
    readonly topologyKind?: string;
    readonly selectsVariant?: string;
    readonly edgeGroupId?: string;
    readonly joinSlotId?: string;
    readonly recurrenceAuthorityId?: string;
}
export interface CanonicalConsumerCapability extends JsonRecord {
    readonly capabilityType: "scenario-driven-capability.v1";
    readonly capabilityId: string;
    readonly scenarios: readonly ProjectedConsumerScenario[];
    readonly transitions: readonly ProjectedConsumerTransition[];
    readonly rootScenarioId?: string;
    readonly edgeGroups?: readonly JsonRecord[];
    readonly recurrenceAuthorities?: readonly JsonRecord[];
    readonly scenarioOutcomes?: readonly JsonRecord[];
    readonly executionTopologyAuthority?: "graph-v3";
    readonly experience?: {
        readonly experienceId: string;
        readonly actor: string;
        readonly promise: string;
        readonly observableConditions: readonly {
            readonly conditionId: string;
            readonly statement: string;
        }[];
    };
}
export interface CanonicalScenarioGraphEvidence {
    readonly evidenceType: "canonical-consumer-scenario-graph-evidence.v1";
    readonly capability: CanonicalConsumerCapability;
    readonly scenarios: readonly ProjectedConsumerScenario[];
    readonly transitions: readonly ProjectedConsumerTransition[];
    readonly sourceRefs: readonly string[];
}
