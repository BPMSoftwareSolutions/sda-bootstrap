import type { SchemaAdmissionPort } from "../../ports/conformance/schema-admission.js";
import type { ClockPort } from "../../ports/infrastructure-ports.js";
import type { ConsumerWorkspaceRepository } from "../../ports/consumer-projection/consumer-workspace-repository.js";
import type { ConsumerWorkspaceFacts } from "../../consumer-projection/model/consumer-workspace-facts.js";
declare function executableOrigin(workspaceRoot: string): ConsumerWorkspaceFacts["executableOrigin"];
export declare class NodeConsumerWorkspaceRepository implements ConsumerWorkspaceRepository {
    private readonly repositoryRoot;
    private readonly admission;
    private readonly clock;
    constructor(repositoryRoot: string, admission: SchemaAdmissionPort, clock: ClockPort);
    load(workspaceRoot: string): ConsumerWorkspaceFacts;
}
export { executableOrigin as observeConsumerExecutableOrigin };
