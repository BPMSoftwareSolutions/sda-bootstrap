import type { ClockPort } from "../../ports/infrastructure-ports.js";
import type { SourceFact } from "../../model/semantic-model.js";
import type { DomainIsolationRepository, DomainIsolationSourceFile } from "../../ports/consumer-projection/domain-isolation-repository.js";
export declare class NodeDomainIsolationRepository implements DomainIsolationRepository {
    private readonly repositoryRoot;
    private readonly clock;
    constructor(repositoryRoot: string, clock: ClockPort);
    load(): SourceFact<readonly DomainIsolationSourceFile[]>;
}
