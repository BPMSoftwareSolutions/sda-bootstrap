import type { SourceFact } from "../../../model/semantic-model.js";
import type { DomainIsolationSourceFile } from "../../../ports/consumer-projection/domain-isolation-repository.js";
import type { DomainIsolationEvidence } from "../../../consumer-projection/proof/domain-isolation-evaluator.js";
export interface ProveDomainIsolationInput {
    readonly sources: SourceFact<readonly DomainIsolationSourceFile[]>;
}
export type ProveDomainIsolationEvidence = DomainIsolationEvidence;
export declare function isProveDomainIsolationInput(value: unknown): value is ProveDomainIsolationInput;
export declare function isProveDomainIsolationEvidence(value: unknown): value is ProveDomainIsolationEvidence;
