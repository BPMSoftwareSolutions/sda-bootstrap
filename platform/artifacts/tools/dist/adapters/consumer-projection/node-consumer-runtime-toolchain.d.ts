import type { ConsumerRuntimeToolchain, InspectableQueryExecutor } from "../../ports/consumer-projection/consumer-runtime-toolchain.js";
import type { ConsumerProjectionTarget, JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
export declare class NodeConsumerRuntimeToolchain implements ConsumerRuntimeToolchain {
    private readonly repositoryRoot;
    private readonly python;
    constructor(repositoryRoot: string);
    available(target: ConsumerProjectionTarget): boolean;
    prepare(target: ConsumerProjectionTarget, workspaceRoot: string): void;
    execute(target: ConsumerProjectionTarget, workspaceRoot: string, interfaceId: string, input: unknown): JsonRecord;
    executeFixture(target: ConsumerProjectionTarget, workspaceRoot: string, interfaceId: string, fixtureId: string): JsonRecord;
    private executeArgument;
}
export declare class NodeInspectableQueryExecutor implements InspectableQueryExecutor {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    execute(catalog: JsonRecord, profile: unknown, queryId: string, params: JsonRecord): Promise<unknown>;
}
