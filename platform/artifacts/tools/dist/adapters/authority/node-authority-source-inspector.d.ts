import type { AuthoritySourceInspection } from "../../capabilities/kernel-implementation-admission/determine-authority-conformance/model.js";
export declare class NodeAuthoritySourceInspector {
    private readonly repositoryRoot;
    constructor(repositoryRoot: string);
    inspect(language: string, manifest: Record<string, unknown>): AuthoritySourceInspection;
    private inspectRegistered;
}
