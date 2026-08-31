export type AuthorityResolutionKind = "DIGEST" | "ALIAS";
export interface ImmutableAuthorityResolution<TValue> {
    readonly authorityId: string;
    readonly selector: string;
    readonly digest: string;
    readonly resolvedBy: AuthorityResolutionKind;
    readonly value: TValue;
}
export interface ImmutableAuthorityRegistry<TValue> {
    resolve(authorityId: string, selector: string): ImmutableAuthorityResolution<TValue> | null;
}
