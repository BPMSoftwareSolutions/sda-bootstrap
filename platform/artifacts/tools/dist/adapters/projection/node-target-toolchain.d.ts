import type { ProjectionTarget } from "../../projection/model/projection-profile.js";
import type { TargetToolchain, ToolchainResult } from "../../projection/toolchain/target-toolchain.js";
export declare class NodeTargetToolchain implements TargetToolchain {
    private readonly repositoryRoot;
    readonly target: ProjectionTarget;
    private readonly languageRoot;
    private readonly pythonExecutable;
    private readonly profile;
    private readonly hostCompatible;
    constructor(repositoryRoot: string, target: ProjectionTarget);
    available(): boolean;
    compileStructural(): ToolchainResult;
    compileExecution(): ToolchainResult;
    proveExecutionBehavior(): ToolchainResult;
    proveConsumerPlatform(): ToolchainResult;
    proveUiClaimant(): ToolchainResult;
    private compileLanguage;
    private legacyCommands;
    private requiredOperation;
    private runOperation;
    private compileJava;
}
