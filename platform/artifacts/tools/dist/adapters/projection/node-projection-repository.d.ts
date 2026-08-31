import type { SourceFact } from "../../model/semantic-model.js";
import type { ClockPort } from "../../ports/infrastructure-ports.js";
import type { JsonSchema } from "../../projection/ir/schema-mechanics.js";
import type { ProjectionTarget, StructuralProjectionProfile } from "../../projection/model/projection-profile.js";
export interface SourceFileFact {
    readonly path: string;
    readonly content: string;
}
export declare class NodeProjectionRepository {
    private readonly repositoryRoot;
    private readonly clock;
    constructor(repositoryRoot: string, clock: ClockPort);
    loadSchemas(): SourceFact<Readonly<Record<string, JsonSchema>>>;
    loadProfile(target: ProjectionTarget): SourceFact<StructuralProjectionProfile>;
    loadAdmittedSource(target: ProjectionTarget): SourceFact<readonly SourceFileFact[]>;
    loadExecutionVector(): SourceFact<unknown>;
    fixtureCount(): number;
}
