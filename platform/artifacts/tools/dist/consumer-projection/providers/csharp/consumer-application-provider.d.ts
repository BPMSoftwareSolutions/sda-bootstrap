import type { ConsumerProjectionPlanFile } from "../../model/consumer-projection-plan.js";
import type { ConsumerApplicationProvider, ConsumerApplicationProviderInput } from "../consumer-application-provider.js";
export declare function resolveAdapterProjectRef(repositoryRoot: string, projectedCsharpDir: string): string;
export declare function resolveWpfProjectRef(repositoryRoot: string, projectedCsharpDir: string): string;
export declare function renderProgram(): string;
export declare function renderSdkProject(adapterProjectRef: string): string;
export declare function renderCliProject(adapterProjectRef: string): string;
type RecordValue = Readonly<Record<string, unknown>>;
export declare function renderWpfApp(): string;
export declare function renderWpfWindow(authority: RecordValue): string;
export declare function renderProjectedUiViewModel(): string;
export declare function renderWpfProject(wpfProjectRef: string): string;
export declare function resolveAvaloniaProjectRef(repositoryRoot: string, projectedAvaloniaDir: string): string;
export declare function resolveUiAuthorityProjectRef(repositoryRoot: string, projectedAvaloniaDir: string): string;
export declare function renderAvaloniaApp(): string;
export declare function renderAvaloniaAppCodeBehind(): string;
export declare function renderAvaloniaProgram(): string;
export declare function renderAvaloniaWindowCodeBehind(): string;
export declare function renderAvaloniaWindow(authority: RecordValue): string;
export declare function renderAvaloniaProject(avaloniaProjectRef: string): string;
export declare function renderSdkClient(): string;
export declare function renderDirectoryBuildProps(buildOutputRoot: string): string;
export declare function renderDirectoryBuildTargets(): string;
export declare class CsharpConsumerApplicationProvider implements ConsumerApplicationProvider {
    readonly target: "csharp";
    render(input: ConsumerApplicationProviderInput): readonly ConsumerProjectionPlanFile[];
}
export {};
