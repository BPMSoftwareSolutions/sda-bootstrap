import type { ConsumerAssuranceEvidenceStore } from "../../ports/consumer-projection/consumer-assurance-evidence-store.js";
export declare class NodeConsumerAssuranceEvidenceStore implements ConsumerAssuranceEvidenceStore {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    write(workspaceRoot: string, relativePath: string, value: unknown): string;
    writeRepository(relativePath: string, value: unknown): string;
    private writeAt;
}
