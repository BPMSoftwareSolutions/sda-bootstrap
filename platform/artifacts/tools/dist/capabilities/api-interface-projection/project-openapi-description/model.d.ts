import { type ApiContractDocument, type ApiOperationGraph } from "../derive-api-operation-graph/model.js";
export interface OpenApiProjectionProfile {
    readonly profileType: "sda-openapi-sdk-profile.v1";
    readonly profileId: string;
    readonly profileVersion: string;
    readonly documentId: string;
    readonly title: string;
    readonly apiVersion: string;
    readonly openapiVersion: "3.1.2";
    readonly jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema";
    readonly requestMediaType: "application/json";
    readonly responseMediaType: "application/json";
    readonly problemMediaType: "application/problem+json";
    readonly securitySchemeId: string;
    readonly oauthTokenUrl: string;
    readonly allowedMethods: readonly ("GET" | "POST")[];
    readonly allowedParameterLocations: readonly ("PATH" | "QUERY" | "HEADER")[];
    readonly allowedSchemaKeywords: readonly string[];
    readonly limits: {
        readonly maximumApis: number;
        readonly maximumOperations: number;
        readonly maximumContracts: number;
    };
    readonly profileDigest: string;
}
export interface ProjectOpenApiDescriptionInput {
    readonly inputType: "sda-openapi-description-projection-input.v1";
    readonly operationGraph: ApiOperationGraph;
    readonly contracts: readonly ApiContractDocument[];
    readonly profile: OpenApiProjectionProfile;
}
export interface OpenApiParameterObject {
    readonly name: string;
    readonly in: "path" | "query" | "header";
    readonly required: boolean;
    readonly schema: Readonly<Record<string, unknown>>;
    readonly "x-sda-parameter-id": string;
    readonly "x-sda-contract-id": string;
}
export interface OpenApiOperationObject {
    readonly tags: readonly string[];
    readonly operationId: string;
    readonly summary: string;
    readonly parameters: readonly OpenApiParameterObject[];
    readonly requestBody?: Readonly<Record<string, unknown>>;
    readonly responses: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    readonly security: readonly Readonly<Record<string, readonly string[]>>[];
    readonly deprecated: boolean;
    readonly "x-sda-interaction": string;
    readonly "x-sda-idempotency": string;
    readonly "x-sda-capability-id": string;
    readonly "x-sda-capability-digest": string;
    readonly "x-sda-scenario-id": string;
    readonly "x-sda-input-contract-id": string;
    readonly "x-sda-result-contract-id": string;
    readonly "x-sda-obligation-id": string;
    readonly "x-sda-experience-id": string;
    readonly "x-sda-interface-authority-digest": string;
}
export interface OpenApiDescription {
    readonly openapi: "3.1.2";
    readonly info: {
        readonly title: string;
        readonly version: string;
    };
    readonly jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema";
    readonly tags: readonly {
        readonly name: string;
        readonly description: string;
    }[];
    readonly paths: Readonly<Record<string, Readonly<Record<string, OpenApiOperationObject>>>>;
    readonly components: {
        readonly schemas: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
        readonly securitySchemes: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    };
    readonly "x-sda-document-id": string;
    readonly "x-sda-operation-graph-digest": string;
    readonly "x-sda-projection-profile-digest": string;
    readonly "x-sda-source-authorities": readonly {
        readonly apiId: string;
        readonly authorityDigest: string;
    }[];
}
export interface OpenApiProjectionEvidence {
    readonly evidenceType: "sda-openapi-projection-evidence.v1";
    readonly operationGraphDigest: string;
    readonly projectionProfileDigest: string;
    readonly document: OpenApiDescription;
    readonly equivalence: {
        readonly disposition: "EQUIVALENT";
        readonly operationCount: number;
        readonly responseCount: number;
        readonly scopeCount: number;
        readonly contractCount: number;
        readonly operationMappings: readonly {
            readonly operationId: string;
            readonly method: "get" | "post";
            readonly path: string;
            readonly documentPointer: string;
        }[];
        readonly contractMappings: readonly {
            readonly contractId: string;
            readonly schemaDigest: string;
            readonly componentName: string;
            readonly documentPointer: string;
        }[];
    };
    readonly documentDigest: string;
    readonly evidenceDigest: string;
}
export declare function isOpenApiProjectionProfile(value: unknown): value is OpenApiProjectionProfile;
export declare function isProjectOpenApiDescriptionInput(value: unknown): value is ProjectOpenApiDescriptionInput;
export declare function isOpenApiProjectionEvidence(value: unknown): value is OpenApiProjectionEvidence;
