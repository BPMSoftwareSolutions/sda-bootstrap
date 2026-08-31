export interface ContractReference {
    readonly contractId: string;
    readonly schemaId?: string;
    readonly version?: string;
    readonly digest?: string;
}
export interface ScenarioInputV1 {
    readonly inputId: string;
    readonly contract: ContractReference;
    readonly semanticType?: string;
}
export interface ScenarioResponsibilityV2 {
    readonly responsibilityId: string;
    readonly statement: string;
}
export interface ScenarioEventV2 {
    readonly eventId: string;
    readonly responsibility: ScenarioResponsibilityV2;
    readonly executionAuthorityId: string;
    readonly executionAuthorityVersion?: string;
    readonly executionAuthorityDigest?: string;
}
export interface ObservableConditionV2 {
    readonly conditionId: string;
    readonly statement: string;
}
export interface ScenarioObligationV2 {
    readonly obligationId: string;
    readonly statement: string;
    readonly observableConditions: readonly ObservableConditionV2[];
}
export interface ScenarioEvidenceV2 {
    readonly contract: ContractReference;
}
export interface PromisedExperienceV2 {
    readonly experienceId: string;
    readonly actor: string;
    readonly promise: string;
}
export interface ScenarioOutcomeV2 {
    readonly outcomeId: string;
    readonly obligation: ScenarioObligationV2;
    readonly evidence: ScenarioEvidenceV2;
    readonly experience: PromisedExperienceV2;
    readonly semanticType?: string;
    readonly terminal?: boolean;
}
export interface ScenarioV2 {
    readonly scenarioType: "scenario.v2";
    readonly scenarioId: string;
    readonly name?: string;
    readonly description?: string;
    readonly input: ScenarioInputV1;
    readonly event: ScenarioEventV2;
    readonly outcome: ScenarioOutcomeV2;
}
export interface CapabilityV2 {
    readonly capabilityType: "scenario-driven-capability.v2";
    readonly capabilityId: string;
    readonly name?: string;
    readonly purpose: string;
    readonly consumer: {
        readonly actor: string;
    };
    readonly interfaces: readonly unknown[];
    readonly scenarios: readonly ScenarioV2[];
}
export interface SourceFact<T> {
    readonly sourceRef: string;
    readonly digest: string;
    readonly observedAt: string;
    readonly value: T;
}
export interface ConditionEvidence {
    readonly conditionId: string;
    readonly disposition: "SATISFIED" | "NOT_SATISFIED" | "NOT_OBSERVABLE";
    readonly evidenceRef?: string;
    readonly detail?: string;
}
export interface EvidenceGap {
    readonly conditionId?: string;
    readonly reason: string;
}
export type ObligationDisposition = {
    readonly kind: "SATISFIED";
    readonly conditionEvidence: readonly ConditionEvidence[];
} | {
    readonly kind: "NOT_SATISFIED";
    readonly conditionEvidence: readonly ConditionEvidence[];
} | {
    readonly kind: "NOT_OBSERVABLE";
    readonly reasons: readonly EvidenceGap[];
};
export interface ScenarioClosure<TEvidence> {
    readonly scenarioId: string;
    readonly executionId: string;
    readonly kernelDisposition: "completed" | "terminated" | "rejected" | "failed";
    readonly evidence: TEvidence | null;
    readonly obligationDisposition: ObligationDisposition;
    readonly experienceDisposition: "REALIZED" | "NOT_REALIZED" | "NOT_OBSERVABLE";
}
