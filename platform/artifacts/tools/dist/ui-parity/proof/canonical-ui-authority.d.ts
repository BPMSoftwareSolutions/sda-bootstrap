import type { JsonRecord } from "../../consumer-projection/model/consumer-workspace-facts.js";
import type { UiAuthorityIdentity, UiExperienceCoverage, UiVectorCorpus } from "../model/ui-parity.js";
export declare function canonicalJson(value: unknown): string;
export declare function canonicalDigest(value: unknown): `sha256:${string}`;
export declare function createUiAuthorityIdentity(authorityRef: string, authority: JsonRecord): UiAuthorityIdentity;
export declare function assertFrozenUiAuthority(identity: UiAuthorityIdentity, authorityRef: string, authority: JsonRecord): void;
export interface UiParityWorkspaceDocuments {
    readonly authorityPath: string;
    readonly authorityRef: string;
    readonly authority: JsonRecord;
    readonly identityPath: string;
    readonly identity: UiAuthorityIdentity;
    readonly vectorPath: string;
    readonly vectorRef: string;
    readonly vectors: UiVectorCorpus;
    readonly coveragePath: string;
    readonly coverageRef: string;
    readonly coverage: UiExperienceCoverage;
}
export declare function loadUiParityWorkspace(workspaceRoot: string): UiParityWorkspaceDocuments;
