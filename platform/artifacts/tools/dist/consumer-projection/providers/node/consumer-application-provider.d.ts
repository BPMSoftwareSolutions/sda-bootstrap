import type { ConsumerProjectionPlanFile } from "../../model/consumer-projection-plan.js";
import type { ConsumerApplicationProvider, ConsumerApplicationProviderInput } from "../consumer-application-provider.js";
export declare function resolvePlatformRuntimeRef(repositoryRoot: string, projectedNodeDir: string): string;
export declare function renderRuntime(platformRuntimeRef: string): string;
export declare function renderQuery(platformRuntimeRef: string): string;
export declare function renderCli(platformRuntimeRef: string): string;
export declare function renderProjectedTest(platformRuntimeRef: string): string;
export declare class NodeConsumerApplicationProvider implements ConsumerApplicationProvider {
    readonly target: "node";
    render(input: ConsumerApplicationProviderInput): readonly ConsumerProjectionPlanFile[];
}
