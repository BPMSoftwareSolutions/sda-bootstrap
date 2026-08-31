export interface ConformanceEvidenceStore {
    readonly artifactsDirectory: string;
    write(relativePath: string, value: unknown): string;
    read(relativePath: string): unknown | null;
    remove(relativePath: string): void;
}
