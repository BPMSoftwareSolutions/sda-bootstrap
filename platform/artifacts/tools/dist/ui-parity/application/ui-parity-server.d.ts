import type { ConsumerSemanticReadModelProvider } from "../../ports/consumer-projection/consumer-semantic-read-model-provider.js";
export interface UiParityServerHandle {
    readonly origin: string;
    readonly close: () => Promise<void>;
}
export type ReactUiServerHandle = UiParityServerHandle;
export declare function startUiParityServer(options: {
    readonly repositoryRoot: string;
    readonly workspaceRoot: string;
    readonly port?: number;
    readonly consumerSemanticReadModelProvider?: ConsumerSemanticReadModelProvider;
}): Promise<UiParityServerHandle>;
export declare const startReactUiServer: typeof startUiParityServer;
