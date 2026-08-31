import type { ClockPort } from "../../ports/infrastructure-ports.js";
import type { AuthorityConformanceInput } from "../../capabilities/kernel-implementation-admission/determine-authority-conformance/model.js";
export declare class NodeAuthorityConformanceRepository {
    private readonly repositoryRoot;
    private readonly clock;
    constructor(repositoryRoot: string, clock: ClockPort);
    load(language: string): AuthorityConformanceInput;
}
