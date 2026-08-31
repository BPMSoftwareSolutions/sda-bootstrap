import type { SchemaAdmissionPort } from "../../ports/conformance/schema-admission.js";
import type { ImmutableAuthorityRegistry, ImmutableAuthorityResolution } from "../../ports/realization-planning/immutable-authority-registry.js";
export type FileAuthorityKind = "INTENT" | "CAPABILITY_REGISTRATION" | "REALIZATION_POLICY" | "ENVIRONMENT_PROFILE" | "CAPABILITY_GRAPH" | "PROVIDER_CATALOG" | "PLANNING_SNAPSHOT" | "POLICY_DECISION_PROFILE" | "PROJECTOR_PROFILE";
export interface FileAuthorityRegistryEntry {
    readonly authorityKind: FileAuthorityKind;
    readonly authorityId: string;
    readonly authorityDigest: string;
    readonly aliases: readonly string[];
    readonly documentRef: string;
    readonly documentPointer: string;
    readonly documentDigest: string;
    readonly schemaFilename: string;
}
export interface FileAuthorityRegistryManifest {
    readonly registryType: "sda-file-authority-registry.v1";
    readonly registryId: string;
    readonly entries: readonly FileAuthorityRegistryEntry[];
    readonly registryDigest: string;
}
export declare class FileSystemImmutableAuthorityRegistry<TValue> implements ImmutableAuthorityRegistry<TValue> {
    readonly manifestDigest: string;
    private readonly valuesByDigest;
    private readonly digestByAlias;
    constructor(options: {
        readonly registryRoot: string;
        readonly manifestRef: string;
        readonly authorityKind: FileAuthorityKind;
        readonly schemaAdmission: SchemaAdmissionPort;
        readonly verifyAuthority: (value: TValue, digest: string, authorityId: string) => boolean;
    });
    resolve(authorityId: string, selector: string): ImmutableAuthorityResolution<TValue> | null;
}
