import type { ProjectionPlan } from "../../projection/model/projection-plan.js";
export interface ProjectionTransaction {
    readonly destination: string;
    readonly stagingDirectory: string;
    activate(): void;
    commit(): void;
    rollback(): void;
}
export interface ProjectionStageOptions {
    readonly preserveExistingFiles?: boolean;
    readonly managedFileExtensions?: readonly string[];
}
export interface ProjectionDirectoryOptions {
    readonly allowLockedDestinationFallback?: boolean;
}
export declare class TransactionalProjectionMaterializer {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    stage(plan: ProjectionPlan, options?: ProjectionStageOptions): ProjectionTransaction;
    stageDirectory(destination: string, populate: (stagingDirectory: string) => void, allowedRoot?: string, options?: ProjectionDirectoryOptions): ProjectionTransaction;
}
