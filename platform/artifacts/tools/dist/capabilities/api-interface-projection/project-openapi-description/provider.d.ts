import type { ResponsibilityProvider } from "../../../ports/capability-ports.js";
import type { OpenApiProjectionEvidence, ProjectOpenApiDescriptionInput } from "./model.js";
export declare class ProjectOpenApiDescriptionProvider implements ResponsibilityProvider<ProjectOpenApiDescriptionInput, OpenApiProjectionEvidence> {
    readonly responsibilityId = "project-operation-graph-into-bounded-openapi-description";
    execute(input: ProjectOpenApiDescriptionInput): Promise<OpenApiProjectionEvidence>;
}
