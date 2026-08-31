import type { SourceFact } from "../../model/semantic-model.js";
export interface DomainIsolationSourceFile {
    readonly path: string;
    readonly content: string;
}
export interface DomainIsolationRepository {
    load(): SourceFact<readonly DomainIsolationSourceFile[]>;
}
