import type { ConsumerProjectionTarget, JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
export interface ConsumerRuntimeToolchain {
    available(target: ConsumerProjectionTarget): boolean;
    prepare(target: ConsumerProjectionTarget, workspaceRoot: string): void;
    execute(target: ConsumerProjectionTarget, workspaceRoot: string, interfaceId: string, input: unknown): JsonRecord;
    executeFixture(target: ConsumerProjectionTarget, workspaceRoot: string, interfaceId: string, fixtureId: string): JsonRecord;
}
export interface InspectableQueryExecutor {
    execute(catalog: JsonRecord, profile: unknown, queryId: string, params: JsonRecord): Promise<unknown>;
}
