import type { ConsumerWorkspaceFacts } from "../../consumer-projection/model/consumer-workspace-facts.js";
export interface ConsumerWorkspaceRepository {
    load(workspaceRoot: string): ConsumerWorkspaceFacts;
}
