import type { ProjectionTarget } from "../model/projection-profile.js";
export interface ExecutionTemplateSet {
    readonly outputDirectory: string;
    readonly files: readonly {
        readonly relativePath: string;
        readonly content: string;
    }[];
}
export declare const executionTemplates: Readonly<Record<ProjectionTarget, ExecutionTemplateSet>>;
