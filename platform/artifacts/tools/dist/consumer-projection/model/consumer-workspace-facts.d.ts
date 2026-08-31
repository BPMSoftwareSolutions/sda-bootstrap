import type { SourceFact } from "../../model/semantic-model.js";
export type ConsumerProjectionTarget = "node" | "csharp" | "python";
export type JsonRecord = Readonly<Record<string, unknown>>;
export interface ConsumerCapabilityDeclaration {
    readonly featureId: string;
    readonly feature: string;
    readonly capability: string;
    readonly semanticGraph: string;
    readonly executionAuthorities: string;
    readonly projectionAuthorities: string;
    readonly interfaces: string;
    readonly fixtures: string;
}
export interface ConsumerWorkspaceAuthority extends JsonRecord {
    readonly workspaceType: "consumer-workspace-authority.v1";
    readonly consumerId: string;
    readonly conformanceQuery: string;
    readonly telemetryAuthority: string;
    readonly platformCapabilityCatalog: string;
    readonly queryCatalog?: string;
    readonly projectionTargets: readonly ConsumerProjectionTarget[];
    readonly capabilities: readonly ConsumerCapabilityDeclaration[];
}
export interface ConsumerInterfaceBinding extends JsonRecord {
    readonly interfaceId: string;
    readonly kind: string;
    readonly rootScenarioId: string;
    readonly platformCapabilityId: string;
    readonly projectionTargets?: readonly ConsumerProjectionTarget[];
    readonly configuration?: JsonRecord;
}
export interface ConsumerUiAuthorityFact {
    readonly authorityRef: string;
    readonly fact: SourceFact<JsonRecord>;
}
export interface ConsumerPortBinding extends JsonRecord {
    readonly portId: string;
    readonly platformCapabilityId: string;
    readonly configuration?: JsonRecord;
}
export interface ProjectedCapabilityInvocationV2Configuration extends JsonRecord {
    readonly bindingRef: string;
    readonly bindingDigest: `sha256:${string}`;
    readonly capabilityAuthorityDigest: `sha256:${string}`;
    readonly requestPath: string;
    readonly resultPath: string;
    readonly lineageMode: "retain-nested-execution";
}
export interface ConsumerProjectionBinding extends JsonRecord {
    readonly projectionId: string;
    readonly platformCapabilityId: string;
    readonly configuration?: JsonRecord;
}
export interface ConsumerInterfaceAuthority extends JsonRecord {
    readonly interfaceAuthorityType: "consumer-interface-authority.v1";
    readonly contractValidatorCapabilityId: string;
    readonly contractCatalog?: string;
    readonly requiredPlatformObligations?: readonly string[];
    readonly interfaces: readonly ConsumerInterfaceBinding[];
    readonly portBindings: readonly ConsumerPortBinding[];
    readonly projectionBindings: readonly ConsumerProjectionBinding[];
}
export interface PlatformCapability extends JsonRecord {
    readonly capabilityId: string;
    readonly kind: string;
    readonly status: string;
    readonly projectionTarget: string;
    readonly provider: string;
    readonly providesMechanics: readonly string[];
    readonly implementationRef: string;
    readonly conformanceRef: string;
}
export interface PlatformCapabilityCatalog extends JsonRecord {
    readonly catalogType: string;
    readonly capabilities: readonly PlatformCapability[];
}
export interface MandatoryMechanicProfile extends JsonRecord {
    readonly profileId: string;
    readonly appliesToBindingStatuses: readonly string[];
    readonly requiredMechanics: readonly string[];
}
export interface ConsumerCrossApplyProofBinding extends JsonRecord {
    readonly target: ConsumerProjectionTarget;
    readonly requestedCapabilityId: string;
    readonly providerCapabilityId: string;
    readonly executionMode: "fixture-port-outcomes-only";
}
export interface ConsumerCrossApplyProofProfile extends JsonRecord {
    readonly proofProfileType: "consumer-cross-apply-proof-profile.v1";
    readonly profileId: string;
    readonly capabilityId: string;
    readonly capsuleDigest: `sha256:${string}`;
    readonly capabilityAuthorityDigest: `sha256:${string}`;
    readonly mandatoryTargets: readonly ConsumerProjectionTarget[];
    readonly bindings: readonly ConsumerCrossApplyProofBinding[];
}
export interface ConsumerContractAuthority extends JsonRecord {
    readonly schemaRef: string;
    readonly schemaId?: string;
    readonly schemaDigest: string;
    readonly schema: JsonRecord;
}
export interface ConsumerContractAuthorities extends JsonRecord {
    readonly authorityType: "consumer-contract-authorities.v1";
    readonly contracts: Readonly<Record<string, ConsumerContractAuthority>>;
}
export interface ConsumerWorkspaceFacts {
    readonly factsType: "consumer-workspace-facts.v1";
    readonly workspaceRoot: string;
    readonly workspace: SourceFact<ConsumerWorkspaceAuthority>;
    readonly declaration: ConsumerCapabilityDeclaration;
    readonly feature: SourceFact<string>;
    readonly semanticGraph: SourceFact<JsonRecord>;
    readonly capabilityAuthority: SourceFact<JsonRecord>;
    readonly executionAuthorities: SourceFact<JsonRecord>;
    readonly projectionAuthorities: SourceFact<JsonRecord>;
    readonly interfaceAuthority: SourceFact<ConsumerInterfaceAuthority>;
    readonly resolvedInterfaceAuthority: ConsumerInterfaceAuthority;
    readonly uiAuthorities: readonly ConsumerUiAuthorityFact[];
    readonly contractAuthorities: ConsumerContractAuthorities | null;
    readonly inspectableQueryCatalog: SourceFact<JsonRecord> | null;
    readonly fixtures: SourceFact<JsonRecord>;
    readonly queryAuthority: SourceFact<JsonRecord>;
    readonly telemetryAuthority: SourceFact<JsonRecord>;
    readonly platformCapabilityCatalog: SourceFact<PlatformCapabilityCatalog>;
    readonly mandatoryMechanicProfile: SourceFact<MandatoryMechanicProfile>;
    readonly executionVector: SourceFact<JsonRecord>;
    readonly executableOrigin: ConsumerExecutableOrigin;
}
export interface ConsumerExecutableOrigin {
    readonly originType: "consumer-executable-origin.v1";
    readonly disposition: "PROJECTED_ONLY" | "REJECTED";
    readonly unauthorizedFiles: readonly string[];
}
export interface ConsumerSourceAdmissionEvidence {
    readonly evidenceType: "consumer-source-admission-evidence.v1";
    readonly workspaceId: string;
    readonly sourceFacts: readonly {
        readonly sourceRef: string;
        readonly digest: string;
    }[];
    readonly facts: ConsumerWorkspaceFacts;
    readonly disposition: "ADMITTED";
}
