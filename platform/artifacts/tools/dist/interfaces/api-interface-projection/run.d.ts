import { type ApiOperationGraph, type DeriveApiOperationGraphInput } from "../../capabilities/api-interface-projection/derive-api-operation-graph/model.js";
import { type OpenApiProjectionEvidence, type ProjectOpenApiDescriptionInput } from "../../capabilities/api-interface-projection/project-openapi-description/model.js";
import type { ScenarioClosure } from "../../model/semantic-model.js";
export interface ApiOperationGraphRun {
    readonly closure: ScenarioClosure<ApiOperationGraph>;
    readonly observations: readonly unknown[];
}
export interface OpenApiProjectionRun {
    readonly closure: ScenarioClosure<OpenApiProjectionEvidence>;
    readonly observations: readonly unknown[];
}
export interface ConfiguredOpenApiProjectionRun extends OpenApiProjectionRun {
    readonly operationGraphRun: ApiOperationGraphRun;
}
export declare function runApiOperationGraph(options: {
    readonly repositoryRoot: string;
    readonly input: DeriveApiOperationGraphInput;
    readonly executionId?: string;
}): Promise<ApiOperationGraphRun>;
export declare function runOpenApiProjection(options: {
    readonly repositoryRoot: string;
    readonly input: ProjectOpenApiDescriptionInput;
    readonly executionId?: string;
}): Promise<OpenApiProjectionRun>;
export declare function runConfiguredApiOperationGraph(options: {
    readonly repositoryRoot: string;
    readonly fixtureRef?: string;
    readonly executionId?: string;
}): Promise<ApiOperationGraphRun>;
export declare function runConfiguredOpenApiProjection(options: {
    readonly repositoryRoot: string;
    readonly fixtureRef?: string;
    readonly executionId?: string;
}): Promise<ConfiguredOpenApiProjectionRun>;
