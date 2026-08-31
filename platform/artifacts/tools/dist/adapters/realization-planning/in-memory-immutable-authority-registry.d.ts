import type { ImmutableAuthorityRegistry, ImmutableAuthorityResolution } from "../../ports/realization-planning/immutable-authority-registry.js";
export interface InMemoryAuthorityEntry<TValue> {
    readonly authorityId: string;
    readonly digest: string;
    readonly aliases: readonly string[];
    readonly value: TValue;
}
export declare class InMemoryImmutableAuthorityRegistry<TValue> implements ImmutableAuthorityRegistry<TValue> {
    private readonly valuesByDigest;
    private readonly digestByAlias;
    constructor(entries: readonly InMemoryAuthorityEntry<TValue>[], verify: (value: TValue, digest: string, authorityId: string) => boolean);
    resolve(authorityId: string, selector: string): ImmutableAuthorityResolution<TValue> | null;
}
