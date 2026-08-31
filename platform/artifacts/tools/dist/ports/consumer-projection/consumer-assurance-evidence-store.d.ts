export interface ConsumerAssuranceEvidenceStore {
    write(workspaceRoot: string, relativePath: string, value: unknown): string;
    writeRepository(relativePath: string, value: unknown): string;
}
