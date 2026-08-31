import type { DeriveApiOperationGraphInput } from "../../capabilities/api-interface-projection/derive-api-operation-graph/model.js";
import type { OpenApiProjectionProfile } from "../../capabilities/api-interface-projection/project-openapi-description/model.js";
import type { NodeApiReferenceHostProfile } from "../../enterprise/interfaces/http/model.js";
import type { NodeRealizationApiReferenceHostProfile } from "../../enterprise/interfaces/http/realization-api-model.js";
export interface ConfiguredOpenApiProjection {
    readonly operationGraphInput: DeriveApiOperationGraphInput;
    readonly profile: OpenApiProjectionProfile;
}
export declare function loadApiOperationGraphFixture(options: {
    readonly repositoryRoot: string;
    readonly fixtureRef: string;
}): DeriveApiOperationGraphInput;
export declare function loadOpenApiProjectionFixture(options: {
    readonly repositoryRoot: string;
    readonly fixtureRef: string;
}): ConfiguredOpenApiProjection;
export declare function loadNodeApiReferenceHostProfile(options: {
    readonly repositoryRoot: string;
    readonly profileRef?: string;
}): NodeApiReferenceHostProfile;
export declare function loadNodeRealizationApiReferenceHostProfile(options: {
    readonly repositoryRoot: string;
    readonly profileRef?: string;
}): NodeRealizationApiReferenceHostProfile;
