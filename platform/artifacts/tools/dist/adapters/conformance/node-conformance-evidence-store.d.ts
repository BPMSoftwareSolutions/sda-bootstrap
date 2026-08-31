import type { ConformanceEvidenceStore } from "../../ports/conformance/conformance-evidence-store.js";
export declare class NodeConformanceEvidenceStore implements ConformanceEvidenceStore {
    readonly artifactsDirectory: string;
    constructor(repositoryRoot: string);
    write(relativePath: string, value: unknown): string;
    read(relativePath: string): unknown | null;
    remove(relativePath: string): void;
}
