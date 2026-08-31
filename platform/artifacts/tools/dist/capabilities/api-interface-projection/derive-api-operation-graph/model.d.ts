import type { ScenarioV2 } from "../../../model/semantic-model.js";
export type ApiMethod = "GET" | "POST";
export type ApiInteraction = "SYNCHRONOUS" | "ASYNCHRONOUS";
export type ApiIdempotency = "REQUIRED" | "CONDITIONAL" | "NOT_APPLICABLE";
export type ApiResponseDisposition = "SUCCESS" | "REJECTION" | "POLICY_DENIAL" | "CONFLICT" | "NOT_FOUND" | "FAILURE";
export interface ApiContractBinding {
    readonly contractId: string;
    readonly contractDigest: string;
}
export interface ApiParameter {
    readonly parameterId: string;
    readonly wireName: string;
    readonly location: "PATH" | "QUERY" | "HEADER";
    readonly required: boolean;
    readonly valueType: "STRING" | "POSITIVE_INTEGER";
}
export interface ApiOperationSource {
    readonly capabilityId: string;
    readonly scenarioId: string;
    readonly inputContractId: string;
    readonly resultContractId: string;
    readonly obligationId: string;
    readonly experienceId: string;
}
export interface ApiOperationAuthority {
    readonly operationId: string;
    readonly summary: string;
    readonly method: ApiMethod;
    readonly path: string;
    readonly interaction: ApiInteraction;
    readonly source: ApiOperationSource;
    readonly body?: ApiContractBinding;
    readonly parameters: readonly ApiParameter[];
    readonly responses: readonly {
        readonly statusCode: number;
        readonly disposition: ApiResponseDisposition;
        readonly contract: ApiContractBinding;
    }[];
    readonly requiredScopes: readonly string[];
    readonly idempotency: ApiIdempotency;
    readonly deprecated: boolean;
}
export interface ApiInterfaceAuthority {
    readonly interfaceAuthorityType: "sda-api-interface-authority.v1";
    readonly apiId: string;
    readonly apiVersion: string;
    readonly title: string;
    readonly operations: readonly ApiOperationAuthority[];
    readonly authorityDigest: string;
}
export interface ApiContractDocument {
    readonly contractId: string;
    readonly schemaRef: string;
    readonly schemaId: string;
    readonly schemaDigest: string;
    readonly schema: Readonly<Record<string, unknown>>;
}
export interface ApiSourceCapability {
    readonly capabilityType: "scenario-driven-capability.v2" | "scenario-driven-capability.v3";
    readonly capabilityId: string;
    readonly scenarios: readonly ScenarioV2[];
    readonly [member: string]: unknown;
}
export interface DeriveApiOperationGraphInput {
    readonly inputType: "sda-api-operation-graph-derivation-input.v1";
    readonly interfaceAuthorities: readonly ApiInterfaceAuthority[];
    readonly capabilities: readonly ApiSourceCapability[];
    readonly contracts: readonly ApiContractDocument[];
}
export interface ApiOperationGraphOperation {
    readonly operationId: string;
    readonly summary: string;
    readonly method: ApiMethod;
    readonly path: string;
    readonly interaction: ApiInteraction;
    readonly body?: ApiContractBinding;
    readonly parameters: readonly ApiParameter[];
    readonly responses: readonly {
        readonly statusCode: number;
        readonly disposition: ApiResponseDisposition;
        readonly contract: ApiContractBinding;
    }[];
    readonly requiredScopes: readonly string[];
    readonly idempotency: ApiIdempotency;
    readonly deprecated: boolean;
    readonly "x-sda-capability-id": string;
    readonly "x-sda-capability-digest": string;
    readonly "x-sda-scenario-id": string;
    readonly "x-sda-input-contract-id": string;
    readonly "x-sda-result-contract-id": string;
    readonly "x-sda-obligation-id": string;
    readonly "x-sda-experience-id": string;
    readonly "x-sda-interface-authority-digest": string;
}
export interface ApiOperationGraph {
    readonly graphType: "sda-api-operation-graph.v1";
    readonly apis: readonly {
        readonly apiId: string;
        readonly apiVersion: string;
        readonly title: string;
        readonly authorityDigest: string;
        readonly operations: readonly ApiOperationGraphOperation[];
    }[];
    readonly contracts: readonly {
        readonly contractId: string;
        readonly schemaId: string;
        readonly schemaDigest: string;
    }[];
    readonly provenance: {
        readonly compilerId: "typescript-api-operation-graph-provider.v1";
        readonly canonicalization: "RFC8785";
        readonly digestAlgorithm: "sha256";
    };
    readonly graphDigest: string;
}
export declare function digestWithoutField(value: object, field: string): string;
export declare function isDeriveApiOperationGraphInput(value: unknown): value is DeriveApiOperationGraphInput;
export declare function isApiOperationGraphEvidence(value: unknown): value is ApiOperationGraph;
