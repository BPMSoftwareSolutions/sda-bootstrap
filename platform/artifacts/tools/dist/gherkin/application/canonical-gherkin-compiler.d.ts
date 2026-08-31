/** A content digest over canonical JSON or exact bytes, depending on its caller. */
export type Digest = `sha256:${string}`;
type RecordValue = Record<string, unknown>;
type Finding = Readonly<{
    code: string;
    message: string;
    sourceRef?: string;
    sourcePointer: string;
    subjectRef?: string;
}>;
export interface GrammarBinding {
    readonly platformCapabilityId: "sda-canonical-gherkin-grammar.v1";
    readonly providerAuthorityRef: string;
    readonly providerAuthorityDigest: Digest;
}
export interface CanonicalGherkinParseRequest {
    readonly contractId: "canonical-gherkin-parse-request.v1";
    readonly sourceRef: string;
    readonly sourceBytesBase64: string;
    readonly mediaType: "text/x.cucumber.gherkin+plain" | "text/x.cucumber.gherkin+markdown";
    readonly declaredDialect: string;
    readonly grammarBinding: GrammarBinding;
}
export interface ParseEvidence {
    readonly contractId: "canonical-gherkin-parse-evidence.v1";
    readonly source: Readonly<{
        sourceRef: string;
        sourceBytesBase64: string;
        sourceDigest: Digest;
        mediaType: string;
        declaredDialect: string;
    }>;
    readonly grammar: Readonly<{
        implementationId: string;
        implementationVersion: string;
        implementationDigest: Digest;
    }>;
    readonly gherkinDocument: RecordValue | null;
    readonly comments: readonly RecordValue[];
    readonly diagnostics: readonly Finding[];
    readonly nodeIdentities: readonly Readonly<{
        nodeIdentity: `gherkin-node:${string}`;
        nodeKind: string;
        sourcePointer: string;
        location: RecordValue;
    }>[];
    readonly astDigest: Digest | null;
    readonly disposition: "PARSED" | "REJECTED";
}
export interface CaseEvidence {
    readonly contractId: "canonical-gherkin-case-compilation-evidence.v1";
    readonly sourceDigest: Digest;
    readonly astDigest: Digest;
    readonly grammarDigest: Digest;
    readonly compiledCases: readonly RecordValue[];
    readonly caseLineage: readonly Readonly<{
        caseId: string;
        astNodeIds: readonly string[];
        sourceLocations: readonly RecordValue[];
    }>[];
    readonly diagnostics: readonly Finding[];
    readonly caseDigest: Digest | null;
    readonly disposition: "COMPILED" | "REJECTED";
}
export interface ProfileEvidence {
    readonly contractId: "sda-annotated-gherkin-profile-admission-evidence.v1";
    readonly sourceDigest: Digest;
    readonly astDigest: Digest;
    readonly caseDigest: Digest;
    readonly profileId: "sda-annotated-gherkin-profile.v1";
    readonly profileDigest: Digest;
    readonly featureIdentity: RecordValue | null;
    readonly scenarioBindings: readonly RecordValue[];
    readonly diagnostics: readonly Finding[];
    readonly disposition: "PROFILE_ADMITTED" | "PROFILE_HELD" | "REJECTED";
    readonly admissionDigest: Digest;
}
export interface CanonicalGherkinCompilation {
    readonly contractId: "canonical-gherkin-compilation.v1";
    readonly source: ParseEvidence["source"];
    readonly compiler: Readonly<{
        authorityId: string;
        authorityVersion: string;
        authorityDigest: Digest;
    }>;
    readonly grammar: Readonly<{
        authorityId: string;
        authorityVersion: string;
        authorityDigest: Digest;
    }>;
    readonly profile: Readonly<{
        authorityId: string;
        authorityVersion: string;
        authorityDigest: Digest;
    }>;
    readonly gherkinDocument: RecordValue;
    readonly comments: readonly RecordValue[];
    readonly compiledCases: readonly RecordValue[];
    readonly diagnostics: readonly Readonly<{
        code: string;
        subjectRef: string;
        message: string;
        sourcePointer?: string;
    }>[];
    readonly astDigest: Digest;
    readonly caseDigest: Digest;
    readonly profileAdmissionDigest: Digest;
    readonly compilationDigest: Digest;
    readonly disposition: "BOUND" | "PROFILE_HELD" | "REJECTED" | "STALE";
    readonly authorityClaims: Readonly<{
        projection: "NOT_CLAIMED";
        execution: "NOT_CLAIMED";
        behavioralConformance: "NOT_CLAIMED";
        companionClosure: "NOT_CLAIMED";
    }>;
}
export interface FixtureSource extends Omit<CanonicalGherkinParseRequest, "contractId" | "grammarBinding"> {
    readonly fixtureId: string;
    readonly sourceDigest: Digest;
    readonly expectedProofPartitions: readonly Partition[];
    readonly expectedParseDisposition: "PARSE_SUCCEEDED" | "PARSE_REJECTED";
    readonly expectedProfileDisposition: "PROFILE_ADMITTED" | "PROFILE_HELD" | "REJECTED" | "NOT_EVALUATED";
    readonly expectedDiagnosticCodes: readonly string[];
}
export declare const GHERKIN_IMPLEMENTATION_ID = "@cucumber/gherkin";
export declare const GHERKIN_IMPLEMENTATION_VERSION = "42.0.1";
export declare const GHERKIN_GRAMMAR_AUTHORITY_ID = "official-cucumber-gherkin-js.v42";
export declare const GHERKIN_COMPILER_AUTHORITY_ID = "canonical-gherkin-compiler.v1";
export declare function canonicalGherkinDigest(value: unknown): Digest;
/** Parses exact bytes with an official Cucumber grammar, without profile admission. */
export declare function parseCanonicalGherkin(request: CanonicalGherkinParseRequest, grammarAuthority: RecordValue): ParseEvidence;
/** Compiles pickles from parse evidence only after digest lineage is checked. */
export declare function compileCanonicalGherkinCases(request: Readonly<{
    contractId: "canonical-gherkin-case-compilation-request.v1";
    parseEvidence: ParseEvidence;
    parseEvidenceDigest: Digest;
    grammarBindingDigest: Digest;
}>, grammarAuthority: RecordValue): CaseEvidence;
/** Applies only the SDA profile policy; it never modifies the parsed syntax document. */
export declare function admitSdaAnnotatedGherkinProfile(request: Readonly<{
    contractId: "sda-annotated-gherkin-profile-admission-request.v1";
    parseEvidence: ParseEvidence;
    caseEvidence: CaseEvidence;
    profile: RecordValue;
    profileDigest: Digest;
}>): ProfileEvidence;
export interface GherkinCompilationAuthoritySet {
    readonly compilerAuthority: RecordValue;
    readonly grammarAuthority: RecordValue;
    readonly profileAuthority: RecordValue;
}
/** Binds mutually consistent evidence into a receipt that explicitly claims no downstream authority. */
export declare function bindCanonicalFeatureCompilation(request: Readonly<{
    contractId: "canonical-feature-compilation-binding-request.v1";
    parseEvidence: ParseEvidence;
    caseEvidence: CaseEvidence;
    profileEvidence: ProfileEvidence;
    compilerAuthorityRef: string;
    compilerAuthorityDigest: Digest;
}>, authorities: GherkinCompilationAuthoritySet): CanonicalGherkinCompilation;
declare const PARTITIONS: readonly ["EXACT_BYTES", "FEATURE_IDENTITY", "SCENARIO_IDENTITY", "ORDERED_STEPS", "STEP_ARGUMENTS", "COMMENTS_AND_NARRATIVE", "DIALECT_AND_ADVANCED_CONSTRUCTS", "CONNECTOR_REFERENCES", "COMPILER_IDENTITIES", "AST_CASE_COMPILATION_DIGESTS", "TYPED_DIAGNOSTICS", "REORDERED_REPRODUCTION"];
type Partition = typeof PARTITIONS[number];
export interface GherkinConformanceAuthoritySet extends GherkinCompilationAuthoritySet {
}
export interface GherkinFixtureManifest {
    readonly fixtureSetDigest: Digest;
    readonly fixtures: readonly Readonly<{
        fixtureId: string;
        path: string;
        sourceDigest: Digest;
        mediaType: string;
        declaredDialect: string;
        expectedProofPartitions: readonly Partition[];
        expectedParseDisposition: FixtureSource["expectedParseDisposition"];
        expectedProfileDisposition: FixtureSource["expectedProfileDisposition"];
        expectedDiagnosticCodes: readonly string[];
    }>[];
    readonly invalidCarrierCases: readonly Readonly<{
        carrierCaseId: string;
        basisFixtureId: string;
        mutation: "NON_CANONICAL_BASE64" | "INVALID_UTF8" | "UNSUPPORTED_MEDIA_TYPE" | "UNSUPPORTED_DIALECT" | "STALE_GRAMMAR_BINDING";
        expectedDiagnosticCode: string;
    }>[];
    readonly reproductionSets: readonly Readonly<{
        reproductionSetId: string;
        fixtureIds: readonly string[];
        discoveryOrders: readonly (readonly string[])[];
        expectedProofPartitions: readonly Partition[];
    }>[];
}
/** Evaluates digest-bound authorities and fixtures repeatedly, producing the conformance capability receipt. */
export declare function verifyGherkinCompilerConformance(request: Readonly<{
    contractId: "gherkin-compiler-conformance-request.v1";
    compilerAuthority: {
        authorityRef: string;
        authorityId: string;
        authorityDigest: Digest;
    };
    grammarAuthority: {
        authorityRef: string;
        authorityId: string;
        authorityDigest: Digest;
    };
    profileAuthority: {
        authorityRef: string;
        authorityId: string;
        authorityDigest: Digest;
    };
    fixtureCorpus: {
        fixtureSetRef: string;
        fixtureSetDigest: Digest;
        fixtureDigests: readonly Digest[];
    };
    requiredPartitions: readonly Partition[];
    reproductionRuns: number;
}>, authorities: GherkinConformanceAuthoritySet, fixtureManifest: GherkinFixtureManifest & RecordValue, fixtures: readonly FixtureSource[]): RecordValue;
export {};
