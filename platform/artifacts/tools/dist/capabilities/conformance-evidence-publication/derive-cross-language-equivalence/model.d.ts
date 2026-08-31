import type { PublishedImplementationEvidence } from "../publish-implementation-evidence/model.js";
export interface CanonicalFixtureIdentity {
    readonly fixtureId: string;
    readonly label: string;
}
export interface CrossLanguageEquivalenceInput {
    readonly admissions: readonly PublishedImplementationEvidence[];
    readonly fixtures: readonly CanonicalFixtureIdentity[];
}
export interface CrossLanguageRow {
    readonly fixtureId: string;
    readonly label: string;
    readonly perLanguage: Readonly<Record<string, "PASS" | "UNVERIFIED" | "NOT_READY">>;
}
export interface CrossLanguageEquivalenceEvidence {
    readonly languages: readonly string[];
    readonly rows: readonly CrossLanguageRow[];
    readonly equivalentCount: number;
    readonly totalFixtures: number;
}
export declare const isCrossLanguageEquivalenceInput: (value: unknown) => value is CrossLanguageEquivalenceInput;
export declare const isCrossLanguageEquivalenceEvidence: (value: unknown) => value is CrossLanguageEquivalenceEvidence;
