import type { ProjectionTarget } from "../model/projection-profile.js";
export interface ToolchainResult {
    readonly command: string;
    readonly ran: boolean;
    readonly exitCode: number | null;
    readonly conforming: boolean;
    readonly reason?: string;
    readonly stderr?: string;
}
export interface TargetToolchain {
    readonly target: ProjectionTarget;
    available(): boolean;
    compileStructural(): ToolchainResult;
    compileExecution(): ToolchainResult;
    proveExecutionBehavior(): ToolchainResult;
    proveConsumerPlatform(): ToolchainResult;
    proveUiClaimant(): ToolchainResult;
}
