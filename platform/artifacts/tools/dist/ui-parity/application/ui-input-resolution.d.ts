import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
import type { ConsumerSemanticReadModelProvider } from "../../ports/consumer-projection/consumer-semantic-read-model-provider.js";
interface SourceBinding {
    readonly role: string;
    readonly stateId: string;
}
interface ResolutionOperation {
    readonly authorityRef: string;
    readonly authorityDigest: string;
    readonly recipeId: string;
    readonly sourceBindings: readonly SourceBinding[];
}
export declare class ConsumerSemanticReadModelError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function assertConsumerInputResolutionOperationSupported(workspaceRoot: string, operation: ResolutionOperation, provider?: ConsumerSemanticReadModelProvider): void;
export declare function resolveConsumerInput(workspaceRoot: string, operation: ResolutionOperation, sourceStates: Readonly<Record<string, unknown>>, provider?: ConsumerSemanticReadModelProvider): Promise<JsonRecord>;
export {};
