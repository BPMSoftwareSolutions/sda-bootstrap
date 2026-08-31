import type { SourceFact } from "../../../model/semantic-model.js";
export type AuthorityAssertion = Readonly<Record<string, unknown>>;
export interface AuthoritySourceInspection {
    readonly conforming: boolean;
    readonly sourceRefs: readonly string[];
    readonly missingSourceRefs?: readonly string[];
    readonly checks: readonly {
        readonly value: string;
        readonly observed: boolean;
    }[];
    readonly reason?: string;
}
export interface AuthorityConformanceInput {
    readonly language: string;
    readonly manifestPath: string;
    readonly manifest: SourceFact<Record<string, unknown>> | null;
    readonly manifestValidation: SourceFact<{
        readonly valid: boolean;
    }> | null;
    readonly canonicalAuthority: SourceFact<{
        readonly assertions: readonly AuthorityAssertion[];
    }>;
    readonly sourceInspection: SourceFact<AuthoritySourceInspection> | null;
}
export interface AuthorityConformanceEvidence {
    readonly language: string;
    readonly manifestPath: string;
    readonly manifestFound: boolean;
    readonly manifestValid?: boolean;
    readonly assertionCount: number;
    readonly canonicalAssertionCount?: number;
    readonly assertionSetConforming?: boolean;
    readonly missingAssertions?: readonly AuthorityAssertion[];
    readonly unexpectedAssertions?: readonly AuthorityAssertion[];
    readonly sourceInspection?: AuthoritySourceInspection;
    readonly conforming: boolean;
}
export declare function isAuthorityConformanceInput(value: unknown): value is AuthorityConformanceInput;
export declare function isAuthorityConformanceEvidence(value: unknown): value is AuthorityConformanceEvidence;
