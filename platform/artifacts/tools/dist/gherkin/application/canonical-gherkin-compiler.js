import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
import { AstBuilder, compile, dialects, GherkinClassicTokenMatcher, GherkinInMarkdownTokenMatcher, Parser } from "@cucumber/gherkin";
import { IdGenerator } from "@cucumber/messages";
export const GHERKIN_IMPLEMENTATION_ID = "@cucumber/gherkin";
export const GHERKIN_IMPLEMENTATION_VERSION = "42.0.1";
export const GHERKIN_GRAMMAR_AUTHORITY_ID = "official-cucumber-gherkin-js.v42";
export const GHERKIN_COMPILER_AUTHORITY_ID = "canonical-gherkin-compiler.v1";
const GHERKIN_GRAMMAR_AUTHORITY_REF = "capabilities/sda-platform/parse-canonical-gherkin-document/official-cucumber-gherkin-grammar.authority.json";
const GHERKIN_COMPILER_AUTHORITY_REF = "capabilities/sda-platform/bind-canonical-feature-compilation/canonical-gherkin-compiler.authority.json";
const GHERKIN_COMPILER_PROVIDER_SOURCE_REF = "tools/src/gherkin/application/canonical-gherkin-compiler.ts";
const SDA_GHERKIN_PROFILE_AUTHORITY_REF = "capabilities/sda-platform/admit-sda-annotated-gherkin-profile/sda-annotated-gherkin-profile.v1.json";
const SEMANTIC_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/;
const SUPPORTED_MEDIA_TYPES = new Set(["text/x.cucumber.gherkin+plain", "text/x.cucumber.gherkin+markdown"]);
const REQUIRED_FEATURE_TAGS = ["capability", "root-scenario"];
const REQUIRED_SCENARIO_TAGS = ["scenario", "input", "input-contract", "event", "event-authority", "outcome", "outcome-contract"];
const HELD_CONSTRUCTS = [
    ["rule", "RULE"], ["background", "BACKGROUND"], ["examples", "EXAMPLES"], ["dataTable", "DATA_TABLE"], ["docString", "DOC_STRING"]
];
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
    }
    return value;
}
export function canonicalGherkinDigest(value) {
    return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}
function digestBytes(value) {
    return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
function repositoryRoot() {
    const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [path.resolve(moduleDirectory, "../../../../.."), path.resolve(moduleDirectory, "../../../..")];
    const resolved = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")) && fs.existsSync(path.join(candidate, "capabilities", "sda-platform")));
    if (resolved === undefined)
        throw new Error("Cannot resolve the Scenario-Driven Architecture repository root.");
    return resolved;
}
function resolveRepositoryRef(ref) {
    const root = repositoryRoot();
    const resolved = path.resolve(root, ref);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`))
        throw new Error(`Authority reference escapes the repository: ${ref}`);
    return resolved;
}
function readCanonicalJson(ref) {
    try {
        return JSON.parse(fs.readFileSync(resolveRepositoryRef(ref), "utf8"));
    }
    catch {
        return null;
    }
}
function canonicalDocumentMatches(supplied, ref) {
    const canonical = readCanonicalJson(ref);
    return canonical !== null && canonicalGherkinDigest(supplied) === canonicalGherkinDigest(canonical);
}
function withoutDigest(value, field) {
    const copy = { ...value };
    delete copy[field];
    return copy;
}
function locationOf(value) {
    const candidate = value;
    const location = candidate?.location;
    return location !== null && typeof location === "object" ? location : { line: 1, column: 1 };
}
function finding(code, message, sourceRef, sourcePointer) {
    return { code, message, sourceRef, sourcePointer };
}
function strictBase64(value) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
        return null;
    const bytes = Buffer.from(value, "base64");
    return bytes.toString("base64") === value ? bytes : null;
}
function grammarFrom(binding) {
    return { implementationId: GHERKIN_IMPLEMENTATION_ID, implementationVersion: GHERKIN_IMPLEMENTATION_VERSION, implementationDigest: binding.providerAuthorityDigest };
}
function isCurrentGrammarAuthority(authority) {
    if (authority.authorityType !== "official-cucumber-gherkin-grammar-authority.v1" ||
        authority.authorityId !== GHERKIN_GRAMMAR_AUTHORITY_ID || authority.authorityRef !== GHERKIN_GRAMMAR_AUTHORITY_REF ||
        authority.authorityVersion !== GHERKIN_IMPLEMENTATION_VERSION || authority.platformCapabilityId !== "sda-canonical-gherkin-grammar.v1" ||
        authority.providerFamily !== "OFFICIAL_CUCUMBER_GHERKIN" || authority.authorityDigest !== authorityDigest(authority) ||
        !canonicalDocumentMatches(authority, GHERKIN_GRAMMAR_AUTHORITY_REF))
        return false;
    const packages = Array.isArray(authority.packages) ? authority.packages : [];
    const expected = new Map([
        ["@cucumber/gherkin", ["42.0.1", "sha512-Kqg0ULhWqbXp/a1c04ND4sS4KTlIL831tQ0NhZLXWdEhT6LiNsZ5LFRzy/lBy7QQpcKhroKp/i3C2WdEnRBKNg=="]],
        ["@cucumber/messages", ["34.2.1", "sha512-aj2iCAG9ZOpMVcMxcgShifv5fbR96b7SMgdWcPXXh2QbFp7OEcAnQ5MC5YfWUDSDasmw7FU5NJEsOrXdTQOU1A=="]]
    ]);
    return packages.length === expected.size && packages.every((item) => expected.get(String(item.name))?.[0] === item.version && expected.get(String(item.name))?.[1] === item.integrity);
}
function parseEvidenceIntegrityFinding(parse, grammarAuthority) {
    const bytes = strictBase64(parse.source.sourceBytesBase64);
    if (bytes === null || digestBytes(bytes) !== parse.source.sourceDigest)
        return "SOURCE_DIGEST_MISMATCH";
    if (parse.disposition !== "PARSED" || parse.gherkinDocument === null || parse.astDigest === null)
        return "PARSE_NOT_COMPILED";
    if (canonicalGherkinDigest({ document: parse.gherkinDocument, comments: parse.comments }) !== parse.astDigest)
        return "AST_DIGEST_MISMATCH";
    if (canonicalGherkinDigest(identities(parse.gherkinDocument, parse.source.sourceDigest)) !== canonicalGherkinDigest(parse.nodeIdentities))
        return "NODE_IDENTITY_MISMATCH";
    if (!isCurrentGrammarAuthority(grammarAuthority) || parse.grammar.implementationId !== GHERKIN_IMPLEMENTATION_ID ||
        parse.grammar.implementationVersion !== GHERKIN_IMPLEMENTATION_VERSION || parse.grammar.implementationDigest !== grammarAuthority.authorityDigest)
        return "GRAMMAR_BINDING_DIGEST_MISMATCH";
    const reproduced = parseCanonicalGherkin({
        contractId: "canonical-gherkin-parse-request.v1",
        sourceRef: parse.source.sourceRef,
        sourceBytesBase64: parse.source.sourceBytesBase64,
        mediaType: parse.source.mediaType,
        declaredDialect: parse.source.declaredDialect,
        grammarBinding: {
            platformCapabilityId: "sda-canonical-gherkin-grammar.v1",
            providerAuthorityRef: String(grammarAuthority.authorityRef),
            providerAuthorityDigest: grammarAuthority.authorityDigest
        }
    }, grammarAuthority);
    if (canonicalGherkinDigest(reproduced) !== canonicalGherkinDigest(parse))
        return "SOURCE_AST_REPRODUCTION_MISMATCH";
    return null;
}
function identities(value, sourceDigest) {
    const found = [];
    const visit = (node, pointer) => {
        if (Array.isArray(node)) {
            node.forEach((entry, index) => visit(entry, `${pointer}/${index}`));
            return;
        }
        if (node === null || typeof node !== "object")
            return;
        const record = node;
        if ("location" in record) {
            const nodeKind = typeof record.keyword === "string" ? record.keyword : (typeof record.name === "string" ? "named-node" : "syntax-node");
            const identity = `gherkin-node:${createHash("sha256").update(`${sourceDigest}\u0000${pointer}\u0000${nodeKind}\u0000${JSON.stringify(canonicalize(locationOf(record)))}`).digest("hex")}`;
            found.push({ nodeIdentity: identity, nodeKind, sourcePointer: pointer || "/", location: locationOf(record) });
        }
        Object.keys(record).sort().forEach((key) => visit(record[key], `${pointer}/${key}`));
    };
    visit(value, "");
    return found;
}
/** Parses exact bytes with an official Cucumber grammar, without profile admission. */
export function parseCanonicalGherkin(request, grammarAuthority) {
    const sourceDigest = (() => { const bytes = strictBase64(request.sourceBytesBase64); return bytes === null ? canonicalGherkinDigest(request.sourceBytesBase64) : digestBytes(bytes); })();
    const source = { sourceRef: request.sourceRef, sourceBytesBase64: request.sourceBytesBase64, sourceDigest, mediaType: request.mediaType, declaredDialect: request.declaredDialect };
    const grammar = grammarFrom(request.grammarBinding);
    const diagnostics = [];
    const bytes = strictBase64(request.sourceBytesBase64);
    if (request.contractId !== "canonical-gherkin-parse-request.v1")
        diagnostics.push(finding("INVALID_CONTRACT_ID", "The parse contract ID is not canonical-gherkin-parse-request.v1.", request.sourceRef, "/contractId"));
    if (bytes === null)
        diagnostics.push(finding("INVALID_SOURCE_BASE64", "Source bytes must use canonical base64.", request.sourceRef, "/sourceBytesBase64"));
    if (!SUPPORTED_MEDIA_TYPES.has(request.mediaType))
        diagnostics.push(finding("UNSUPPORTED_MEDIA_TYPE", "Only canonical plain or markdown Gherkin media types are admitted.", request.sourceRef, "/mediaType"));
    if (!(request.declaredDialect in dialects))
        diagnostics.push(finding("UNSUPPORTED_DIALECT", "The declared Gherkin dialect is unknown to the pinned grammar.", request.sourceRef, "/declaredDialect"));
    if (!isCurrentGrammarAuthority(grammarAuthority) || request.grammarBinding.platformCapabilityId !== "sda-canonical-gherkin-grammar.v1" ||
        request.grammarBinding.providerAuthorityRef !== grammarAuthority.authorityRef || request.grammarBinding.providerAuthorityDigest !== grammarAuthority.authorityDigest)
        diagnostics.push(finding("STALE_GRAMMAR_BINDING", "The grammar binding does not resolve to the pinned current official grammar authority.", request.sourceRef, "/grammarBinding"));
    let text = "";
    if (bytes !== null) {
        try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        catch {
            diagnostics.push(finding("INVALID_UTF8", "Source bytes are not valid UTF-8.", request.sourceRef, "/sourceBytesBase64"));
        }
    }
    if (diagnostics.length > 0)
        return { contractId: "canonical-gherkin-parse-evidence.v1", source, grammar, gherkinDocument: null, comments: [], diagnostics, nodeIdentities: [], astDigest: null, disposition: "REJECTED" };
    try {
        const id = IdGenerator.incrementing();
        const builder = new AstBuilder(id);
        const matcher = request.mediaType === "text/x.cucumber.gherkin+markdown" ? new GherkinInMarkdownTokenMatcher(request.declaredDialect) : new GherkinClassicTokenMatcher(request.declaredDialect);
        const document = new Parser(builder, matcher).parse(text);
        const documentDialect = (document.feature?.language);
        if (typeof documentDialect === "string" && documentDialect !== request.declaredDialect)
            diagnostics.push(finding("DIALECT_MISMATCH", "The source language differs from the declared dialect.", request.sourceRef, "/feature/language"));
        if (diagnostics.length > 0)
            return { contractId: "canonical-gherkin-parse-evidence.v1", source, grammar, gherkinDocument: null, comments: [], diagnostics, nodeIdentities: [], astDigest: null, disposition: "REJECTED" };
        const comments = builder.comments;
        return { contractId: "canonical-gherkin-parse-evidence.v1", source, grammar, gherkinDocument: document, comments, diagnostics: [], nodeIdentities: identities(document, sourceDigest), astDigest: canonicalGherkinDigest({ document, comments }), disposition: "PARSED" };
    }
    catch (error) {
        const maybe = error;
        const parseErrors = maybe.errors ?? [maybe];
        return { contractId: "canonical-gherkin-parse-evidence.v1", source, grammar, gherkinDocument: null, comments: [], diagnostics: parseErrors.map((entry, index) => finding("GHERKIN_PARSE_ERROR", entry.message ?? "Official Gherkin parser rejected the source.", request.sourceRef, `/parse/${index}/${locationOf(entry).line ?? 1}:${locationOf(entry).column ?? 1}`)), nodeIdentities: [], astDigest: null, disposition: "REJECTED" };
    }
}
/** Compiles pickles from parse evidence only after digest lineage is checked. */
export function compileCanonicalGherkinCases(request, grammarAuthority) {
    const parse = request.parseEvidence;
    const rejected = (code, message) => ({ contractId: "canonical-gherkin-case-compilation-evidence.v1", sourceDigest: parse.source.sourceDigest, astDigest: parse.astDigest ?? canonicalGherkinDigest(null), grammarDigest: request.grammarBindingDigest, compiledCases: [], caseLineage: [], diagnostics: [finding(code, message, parse.source.sourceRef, "/")], caseDigest: null, disposition: "REJECTED" });
    if (request.contractId !== "canonical-gherkin-case-compilation-request.v1")
        return rejected("INVALID_CONTRACT_ID", "The case compilation contract ID is invalid.");
    if (canonicalGherkinDigest(parse) !== request.parseEvidenceDigest)
        return rejected("PARSE_EVIDENCE_DIGEST_MISMATCH", "The supplied parse evidence digest does not match its exact contents.");
    const integrityFinding = parseEvidenceIntegrityFinding(parse, grammarAuthority);
    if (integrityFinding)
        return rejected(integrityFinding, "Parse source, AST, node identity, or grammar lineage does not match its current authority.");
    if (parse.grammar.implementationDigest !== request.grammarBindingDigest || request.grammarBindingDigest !== grammarAuthority.authorityDigest)
        return rejected("GRAMMAR_BINDING_DIGEST_MISMATCH", "The requested grammar binding does not match parse evidence.");
    try {
        const cases = compile(parse.gherkinDocument, parse.source.sourceRef, IdGenerator.incrementing());
        const astLocations = new Map();
        const collectLocations = (node) => {
            if (Array.isArray(node)) {
                node.forEach(collectLocations);
                return;
            }
            if (node === null || typeof node !== "object")
                return;
            const record = node;
            if (typeof record.id === "string" && record.location && typeof record.location === "object")
                astLocations.set(record.id, record.location);
            Object.values(record).forEach(collectLocations);
        };
        collectLocations(parse.gherkinDocument);
        const lineage = cases.map((item) => {
            const astNodeIds = [
                ...(Array.isArray(item.astNodeIds) ? item.astNodeIds.map(String) : []),
                ...(Array.isArray(item.steps) ? item.steps.flatMap((step) => Array.isArray(step.astNodeIds) ? step.astNodeIds.map(String) : []) : [])
            ];
            const sourceLocations = [
                ...(item.location && typeof item.location === "object" ? [item.location] : []),
                ...astNodeIds.flatMap((id) => astLocations.has(id) ? [astLocations.get(id)] : [])
            ].filter((location, index, all) => all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(location)) === index);
            return { caseId: String(item.id), astNodeIds: [...new Set(astNodeIds)], sourceLocations };
        });
        return { contractId: "canonical-gherkin-case-compilation-evidence.v1", sourceDigest: parse.source.sourceDigest, astDigest: parse.astDigest, grammarDigest: request.grammarBindingDigest, compiledCases: cases, caseLineage: lineage, diagnostics: [], caseDigest: canonicalGherkinDigest({ cases, lineage }), disposition: "COMPILED" };
    }
    catch (error) {
        return rejected("GHERKIN_CASE_COMPILATION_ERROR", error instanceof Error ? error.message : "Official case compilation failed.");
    }
}
function tagParts(node) {
    const tags = Array.isArray(node.tags) ? node.tags : [];
    return tags.map((tag) => {
        const raw = String(tag.name ?? "").replace(/^@/, "");
        const separator = raw.indexOf(":");
        return { key: separator < 0 ? raw : raw.slice(0, separator), value: separator < 0 ? "" : raw.slice(separator + 1), location: locationOf(tag) };
    });
}
function scenarios(feature) {
    const result = [];
    const walk = (children, pointer) => {
        if (!Array.isArray(children))
            return;
        children.forEach((child, index) => {
            const record = child;
            if (record.scenario && typeof record.scenario === "object")
                result.push({ scenario: record.scenario, pointer: `${pointer}/${index}/scenario` });
            if (record.rule && typeof record.rule === "object")
                walk(record.rule.children, `${pointer}/${index}/rule/children`);
        });
    };
    walk(feature.children, "/feature/children");
    return result;
}
function advancedFindings(document, sourceRef) {
    const output = [];
    const inspect = (node, pointer) => {
        if (Array.isArray(node)) {
            node.forEach((entry, index) => inspect(entry, `${pointer}/${index}`));
            return;
        }
        if (node === null || typeof node !== "object")
            return;
        const record = node;
        for (const [property, construct] of HELD_CONSTRUCTS) {
            const candidate = record[property];
            const present = Array.isArray(candidate) ? candidate.length > 0 : candidate !== null && candidate !== undefined;
            if (present)
                output.push(finding("PROFILE_CONSTRUCT_HELD", `${construct} is parsed but not admitted by profile v1.`, sourceRef, `${pointer}/${property}`));
        }
        if (Array.isArray(record.examples) && record.examples.length > 0)
            output.push(finding("PROFILE_CONSTRUCT_HELD", "SCENARIO_OUTLINE is parsed but not admitted by profile v1.", sourceRef, pointer));
        Object.keys(record).forEach((key) => inspect(record[key], `${pointer}/${key}`));
    };
    inspect(document, "");
    const language = (document.feature?.language);
    if (language !== undefined && language !== "en")
        output.push(finding("PROFILE_CONSTRUCT_HELD", "LOCALIZED_DIALECT is parsed but not admitted by profile v1.", sourceRef, "/feature/language"));
    return output;
}
function caseEvidenceIntegrityFinding(parse, cases) {
    if (cases.disposition !== "COMPILED" || cases.caseDigest === null)
        return "CASE_COMPILATION_UNAVAILABLE";
    if (cases.sourceDigest !== parse.source.sourceDigest || cases.astDigest !== parse.astDigest || cases.grammarDigest !== parse.grammar.implementationDigest)
        return "CASE_LINEAGE_MISMATCH";
    if (canonicalGherkinDigest({ cases: cases.compiledCases, lineage: cases.caseLineage }) !== cases.caseDigest)
        return "CASE_DIGEST_MISMATCH";
    return null;
}
/** Applies only the SDA profile policy; it never modifies the parsed syntax document. */
export function admitSdaAnnotatedGherkinProfile(request) {
    const parse = request.parseEvidence;
    const cases = request.caseEvidence;
    const base = { contractId: "sda-annotated-gherkin-profile-admission-evidence.v1", sourceDigest: parse.source.sourceDigest, astDigest: parse.astDigest ?? canonicalGherkinDigest(null), caseDigest: cases.caseDigest ?? canonicalGherkinDigest(null), profileId: "sda-annotated-gherkin-profile.v1", profileDigest: request.profileDigest };
    const diagnostics = [];
    if (request.contractId !== "sda-annotated-gherkin-profile-admission-request.v1")
        diagnostics.push(finding("INVALID_CONTRACT_ID", "The profile admission contract ID is invalid.", parse.source.sourceRef, "/contractId"));
    if (canonicalGherkinDigest(request.profile) !== request.profileDigest)
        diagnostics.push(finding("PROFILE_DIGEST_MISMATCH", "Profile digest does not match the supplied profile authority.", parse.source.sourceRef, "/profile"));
    if (!isCurrentProfileAuthority(request.profile))
        diagnostics.push(finding("PROFILE_AUTHORITY_MISMATCH", "Profile content does not resolve to the repository-admitted SDA Gherkin profile authority.", parse.source.sourceRef, "/profile"));
    if (request.profile.lifecycle !== "ADMITTED")
        diagnostics.push(finding("PROFILE_NOT_ADMITTED", "Only an admitted SDA Gherkin profile can issue admission evidence.", parse.source.sourceRef, "/profile/lifecycle"));
    if (parse.disposition !== "PARSED" || parse.gherkinDocument === null || cases.disposition !== "COMPILED" || cases.caseDigest === null || parse.astDigest === null)
        diagnostics.push(finding("COMPILATION_LINEAGE_UNAVAILABLE", "Profile admission requires parsed and compiled evidence.", parse.source.sourceRef, "/"));
    if (parse.gherkinDocument !== null && parse.astDigest !== null && canonicalGherkinDigest({ document: parse.gherkinDocument, comments: parse.comments }) !== parse.astDigest)
        diagnostics.push(finding("AST_DIGEST_MISMATCH", "Profile admission cannot use syntax whose AST digest is stale.", parse.source.sourceRef, "/parseEvidence/astDigest"));
    const caseIntegrity = caseEvidenceIntegrityFinding(parse, cases);
    if (caseIntegrity)
        diagnostics.push(finding(caseIntegrity, "Profile admission cannot use stale or inconsistent case evidence.", parse.source.sourceRef, "/caseEvidence"));
    const feature = parse.gherkinDocument?.feature;
    let featureIdentity = null;
    const bindings = [];
    if (feature) {
        const featureTags = tagParts(feature);
        for (const key of REQUIRED_FEATURE_TAGS) {
            const matches = featureTags.filter((tag) => tag.key === key);
            if (matches.length === 0)
                diagnostics.push(finding("MISSING_REQUIRED_TAG", `Missing required feature tag @${key}.`, parse.source.sourceRef, "/feature/tags"));
            if (matches.length > 1)
                matches.forEach((tag) => diagnostics.push(finding("REPEATED_REQUIRED_TAG", `Feature tag @${key} is singleton.`, parse.source.sourceRef, `/feature/tags/${tag.location.line ?? 1}`)));
            matches.filter((tag) => !SEMANTIC_ID_PATTERN.test(tag.value)).forEach((tag) => diagnostics.push(finding("INVALID_SEMANTIC_ID", `Feature tag @${key} requires one non-empty semantic ID.`, parse.source.sourceRef, `/feature/tags/${tag.location.line ?? 1}`)));
        }
        const capability = featureTags.find((tag) => tag.key === "capability")?.value;
        const rootScenario = featureTags.find((tag) => tag.key === "root-scenario")?.value;
        featureIdentity = capability && SEMANTIC_ID_PATTERN.test(capability) ? { capabilityId: capability, semanticObjectId: `capability:${capability}`, sourcePointer: "/feature" } : null;
        for (const tag of featureTags.filter((item) => ["provider", "framework", "endpoint", "executable"].includes(item.key)))
            diagnostics.push(finding("FORBIDDEN_SEMANTIC_CONTENT", `@${tag.key} is implementation authority and cannot be semantic authority.`, parse.source.sourceRef, `/feature/tags/${tag.location.line ?? 1}`));
        const scenarioIds = new Set();
        for (const entry of scenarios(feature)) {
            const tags = tagParts(entry.scenario);
            const values = new Map();
            for (const required of REQUIRED_SCENARIO_TAGS) {
                const matches = tags.filter((tag) => tag.key === required);
                values.set(required, matches);
                if (matches.length === 0)
                    diagnostics.push(finding("MISSING_REQUIRED_TAG", `Missing required scenario tag @${required}.`, parse.source.sourceRef, `${entry.pointer}/tags`));
                if (matches.length > 1)
                    matches.forEach((tag) => diagnostics.push(finding("REPEATED_REQUIRED_TAG", `Scenario tag @${required} is singleton.`, parse.source.sourceRef, `${entry.pointer}/tags/${tag.location.line ?? 1}`)));
                matches.filter((tag) => !SEMANTIC_ID_PATTERN.test(tag.value)).forEach((tag) => diagnostics.push(finding("INVALID_SEMANTIC_ID", `Scenario tag @${required} requires one non-empty semantic ID.`, parse.source.sourceRef, `${entry.pointer}/tags/${tag.location.line ?? 1}`)));
            }
            const id = values.get("scenario")?.[0]?.value;
            const validId = id !== undefined && SEMANTIC_ID_PATTERN.test(id);
            if (validId && scenarioIds.has(id))
                diagnostics.push(finding("DUPLICATE_SEMANTIC_IDENTITY", `Scenario identity ${id} is duplicated.`, parse.source.sourceRef, entry.pointer));
            if (validId)
                scenarioIds.add(id);
            for (const tag of tags.filter((item) => ["provider", "framework", "endpoint", "executable"].includes(item.key)))
                diagnostics.push(finding("FORBIDDEN_SEMANTIC_CONTENT", `@${tag.key} is implementation authority and cannot be semantic authority.`, parse.source.sourceRef, `${entry.pointer}/tags/${tag.location.line ?? 1}`));
            const connectorKeys = ["input", "input-contract", "event", "event-authority", "outcome", "outcome-contract"];
            const connectorsValid = connectorKeys.every((key) => {
                const matches = values.get(key) ?? [];
                return matches.length === 1 && SEMANTIC_ID_PATTERN.test(matches[0].value);
            });
            if (validId && connectorsValid)
                bindings.push({
                    scenarioId: id,
                    semanticObjectId: `scenario:${id}`,
                    ownerScopedIdentities: Object.fromEntries(connectorKeys.map((key) => {
                        const localId = values.get(key)[0].value;
                        return [key, { ownerScenarioId: id, localId, semanticObjectId: `${key}:${id}:${localId}` }];
                    })),
                    sourcePointer: entry.pointer
                });
        }
        if (rootScenario && !scenarioIds.has(rootScenario))
            diagnostics.push(finding("ROOT_SCENARIO_NOT_FOUND", "@root-scenario does not resolve to a declared scenario identity.", parse.source.sourceRef, "/feature/tags"));
        diagnostics.push(...advancedFindings(parse.gherkinDocument, parse.source.sourceRef));
    }
    const rejectionCodes = new Set(["INVALID_CONTRACT_ID", "PROFILE_DIGEST_MISMATCH", "PROFILE_AUTHORITY_MISMATCH", "PROFILE_NOT_ADMITTED", "COMPILATION_LINEAGE_UNAVAILABLE", "AST_DIGEST_MISMATCH", "CASE_COMPILATION_UNAVAILABLE", "CASE_LINEAGE_MISMATCH", "CASE_DIGEST_MISMATCH", "MISSING_REQUIRED_TAG", "REPEATED_REQUIRED_TAG", "INVALID_SEMANTIC_ID", "DUPLICATE_SEMANTIC_IDENTITY", "ROOT_SCENARIO_NOT_FOUND", "FORBIDDEN_SEMANTIC_CONTENT"]);
    const disposition = diagnostics.some((entry) => rejectionCodes.has(entry.code)) ? "REJECTED" : diagnostics.some((entry) => entry.code === "PROFILE_CONSTRUCT_HELD") ? "PROFILE_HELD" : "PROFILE_ADMITTED";
    const draft = { ...base, featureIdentity, scenarioBindings: bindings, diagnostics, disposition };
    return { ...draft, admissionDigest: canonicalGherkinDigest(draft) };
}
function isCurrentCompilerAuthority(authority) {
    if (!(authority.authorityType === "canonical-gherkin-compiler-authority.v1" &&
        authority.authorityId === GHERKIN_COMPILER_AUTHORITY_ID && authority.authorityRef === GHERKIN_COMPILER_AUTHORITY_REF &&
        authority.authorityVersion === "1.0.0" && authority.authorityDigest === authorityDigest(authority) &&
        authority.providerSourceRef === GHERKIN_COMPILER_PROVIDER_SOURCE_REF &&
        typeof authority.providerSourceDigest === "string" && /^sha256:[a-f0-9]{64}$/.test(authority.providerSourceDigest) &&
        canonicalDocumentMatches(authority, GHERKIN_COMPILER_AUTHORITY_REF)))
        return false;
    try {
        return digestBytes(fs.readFileSync(resolveRepositoryRef(GHERKIN_COMPILER_PROVIDER_SOURCE_REF))) === authority.providerSourceDigest;
    }
    catch {
        return false;
    }
}
function isCurrentProfileAuthority(authority) {
    return authority.profileType === "sda-annotated-gherkin-profile.v1" && authority.lifecycle === "ADMITTED" &&
        canonicalDocumentMatches(authority, SDA_GHERKIN_PROFILE_AUTHORITY_REF);
}
/** Binds mutually consistent evidence into a receipt that explicitly claims no downstream authority. */
export function bindCanonicalFeatureCompilation(request, authorities) {
    const parse = request.parseEvidence;
    const cases = request.caseEvidence;
    const profile = request.profileEvidence;
    const diagnostics = [];
    if (request.contractId !== "canonical-feature-compilation-binding-request.v1")
        diagnostics.push({ code: "INVALID_CONTRACT_ID", subjectRef: "/contractId", message: "The binding contract ID is invalid." });
    const staleCompiler = !isCurrentCompilerAuthority(authorities.compilerAuthority) || !isCurrentGrammarAuthority(authorities.grammarAuthority) || !isCurrentProfileAuthority(authorities.profileAuthority) ||
        request.compilerAuthorityRef !== authorities.compilerAuthority.authorityRef || request.compilerAuthorityDigest !== authorities.compilerAuthority.authorityDigest;
    if (staleCompiler)
        diagnostics.push({ code: "STALE_COMPILER_AUTHORITY", subjectRef: request.compilerAuthorityRef, message: "The compiler authority identity or digest is not current." });
    if (parse.astDigest === null || cases.caseDigest === null || parse.gherkinDocument === null)
        diagnostics.push({ code: "COMPILATION_COMPONENT_UNAVAILABLE", subjectRef: parse.source.sourceRef, message: "A rejected parse or case component cannot be bound." });
    const parseIntegrity = parseEvidenceIntegrityFinding(parse, authorities.grammarAuthority);
    const caseIntegrity = caseEvidenceIntegrityFinding(parse, cases);
    if (parseIntegrity || caseIntegrity || parse.astDigest !== profile.astDigest || parse.source.sourceDigest !== profile.sourceDigest || cases.caseDigest !== profile.caseDigest)
        diagnostics.push({ code: "COMPILATION_LINEAGE_MISMATCH", subjectRef: parse.source.sourceRef, message: "Parse, cases, and profile evidence do not reproduce current component digests." });
    if (parse.disposition === "PARSED") {
        const expectedCases = compileCanonicalGherkinCases({
            contractId: "canonical-gherkin-case-compilation-request.v1",
            parseEvidence: parse,
            parseEvidenceDigest: canonicalGherkinDigest(parse),
            grammarBindingDigest: authorities.grammarAuthority.authorityDigest
        }, authorities.grammarAuthority);
        if (canonicalGherkinDigest(expectedCases) !== canonicalGherkinDigest(cases))
            diagnostics.push({ code: "CASE_EVIDENCE_REPRODUCTION_MISMATCH", subjectRef: parse.source.sourceRef, message: "Case evidence does not reproduce from the bound parse and grammar." });
        const expectedProfile = admitSdaAnnotatedGherkinProfile({
            contractId: "sda-annotated-gherkin-profile-admission-request.v1",
            parseEvidence: parse,
            caseEvidence: expectedCases,
            profile: authorities.profileAuthority,
            profileDigest: canonicalGherkinDigest(authorities.profileAuthority)
        });
        if (canonicalGherkinDigest(expectedProfile) !== canonicalGherkinDigest(profile))
            diagnostics.push({ code: "PROFILE_EVIDENCE_REPRODUCTION_MISMATCH", subjectRef: parse.source.sourceRef, message: "Profile evidence does not reproduce from the bound syntax, cases, and profile authority." });
    }
    const authorityClaims = { projection: "NOT_CLAIMED", execution: "NOT_CLAIMED", behavioralConformance: "NOT_CLAIMED", companionClosure: "NOT_CLAIMED" };
    const disposition = staleCompiler ? "STALE" : diagnostics.length > 0 ? "REJECTED" : profile.disposition === "PROFILE_HELD" ? "PROFILE_HELD" : profile.disposition === "REJECTED" ? "REJECTED" : "BOUND";
    const draft = {
        contractId: "canonical-gherkin-compilation.v1", source: parse.source,
        compiler: { authorityId: String(authorities.compilerAuthority.authorityId), authorityVersion: String(authorities.compilerAuthority.authorityVersion), authorityDigest: request.compilerAuthorityDigest },
        grammar: { authorityId: parse.grammar.implementationId, authorityVersion: parse.grammar.implementationVersion, authorityDigest: parse.grammar.implementationDigest },
        profile: { authorityId: profile.profileId, authorityVersion: "1", authorityDigest: profile.profileDigest },
        gherkinDocument: (parse.gherkinDocument ?? {}), comments: parse.comments, compiledCases: cases.compiledCases,
        diagnostics: [...diagnostics, ...profile.diagnostics.map((entry) => ({ code: entry.code, subjectRef: entry.sourcePointer, message: entry.message, sourcePointer: entry.sourcePointer }))],
        astDigest: parse.astDigest ?? canonicalGherkinDigest(null), caseDigest: cases.caseDigest ?? canonicalGherkinDigest(null), profileAdmissionDigest: profile.admissionDigest, disposition, authorityClaims
    };
    return { ...draft, compilationDigest: canonicalGherkinDigest(draft) };
}
const PARTITIONS = ["EXACT_BYTES", "FEATURE_IDENTITY", "SCENARIO_IDENTITY", "ORDERED_STEPS", "STEP_ARGUMENTS", "COMMENTS_AND_NARRATIVE", "DIALECT_AND_ADVANCED_CONSTRUCTS", "CONNECTOR_REFERENCES", "COMPILER_IDENTITIES", "AST_CASE_COMPILATION_DIGESTS", "TYPED_DIAGNOSTICS", "REORDERED_REPRODUCTION"];
function authorityDigest(authority) {
    return canonicalGherkinDigest(withoutDigest(authority, "authorityDigest"));
}
function uniqueSorted(values) {
    return [...new Set(values)].sort();
}
function evaluateFixture(fixture, request, authorities) {
    const parse = parseCanonicalGherkin({
        contractId: "canonical-gherkin-parse-request.v1",
        sourceRef: fixture.sourceRef,
        sourceBytesBase64: fixture.sourceBytesBase64,
        mediaType: fixture.mediaType,
        declaredDialect: fixture.declaredDialect,
        grammarBinding: {
            platformCapabilityId: "sda-canonical-gherkin-grammar.v1",
            providerAuthorityRef: request.grammarAuthority.authorityRef,
            providerAuthorityDigest: request.grammarAuthority.authorityDigest
        }
    }, authorities.grammarAuthority);
    if (parse.disposition === "REJECTED") {
        return {
            fixtureId: fixture.fixtureId,
            expectedProofPartitions: fixture.expectedProofPartitions,
            expectedParseDisposition: fixture.expectedParseDisposition,
            expectedProfileDisposition: fixture.expectedProfileDisposition,
            expectedDiagnosticCodes: fixture.expectedDiagnosticCodes,
            expectedSourceDigest: fixture.sourceDigest,
            sourceDigest: parse.source.sourceDigest,
            parse,
            cases: null,
            admission: null,
            receipt: null
        };
    }
    const cases = compileCanonicalGherkinCases({
        contractId: "canonical-gherkin-case-compilation-request.v1",
        parseEvidence: parse,
        parseEvidenceDigest: canonicalGherkinDigest(parse),
        grammarBindingDigest: request.grammarAuthority.authorityDigest
    }, authorities.grammarAuthority);
    const admission = admitSdaAnnotatedGherkinProfile({
        contractId: "sda-annotated-gherkin-profile-admission-request.v1",
        parseEvidence: parse,
        caseEvidence: cases,
        profile: authorities.profileAuthority,
        profileDigest: request.profileAuthority.authorityDigest
    });
    const receipt = bindCanonicalFeatureCompilation({
        contractId: "canonical-feature-compilation-binding-request.v1",
        parseEvidence: parse,
        caseEvidence: cases,
        profileEvidence: admission,
        compilerAuthorityRef: String(authorities.compilerAuthority.authorityRef),
        compilerAuthorityDigest: request.compilerAuthority.authorityDigest
    }, authorities);
    return {
        fixtureId: fixture.fixtureId,
        expectedProofPartitions: fixture.expectedProofPartitions,
        expectedParseDisposition: fixture.expectedParseDisposition,
        expectedProfileDisposition: fixture.expectedProfileDisposition,
        expectedDiagnosticCodes: fixture.expectedDiagnosticCodes,
        expectedSourceDigest: fixture.sourceDigest,
        sourceDigest: parse.source.sourceDigest,
        parse,
        cases,
        admission,
        receipt
    };
}
function fixtureMatchesExpectedDisposition(evaluation) {
    const parseMatches = evaluation.expectedParseDisposition === "PARSE_SUCCEEDED"
        ? evaluation.parse.disposition === "PARSED"
        : evaluation.parse.disposition === "REJECTED";
    if (!parseMatches)
        return false;
    const profileMatches = evaluation.expectedProfileDisposition === "NOT_EVALUATED"
        ? evaluation.admission === null
        : evaluation.admission?.disposition === evaluation.expectedProfileDisposition;
    const actualCodes = uniqueSorted((evaluation.parse.disposition === "REJECTED" ? evaluation.parse.diagnostics : evaluation.admission?.diagnostics ?? []).map((item) => item.code));
    return profileMatches && JSON.stringify(actualCodes) === JSON.stringify(uniqueSorted(evaluation.expectedDiagnosticCodes));
}
function partitionSatisfied(partition, evaluations, reproduced, carrierCasesSatisfied) {
    if (!evaluations.every(fixtureMatchesExpectedDisposition))
        return false;
    switch (partition) {
        case "EXACT_BYTES":
            return evaluations.every((item) => {
                const bytes = strictBase64(item.parse.source.sourceBytesBase64);
                return bytes !== null && item.parse.source.sourceDigest === item.expectedSourceDigest && digestBytes(bytes) === item.expectedSourceDigest;
            });
        case "FEATURE_IDENTITY":
            return evaluations.every((item) => typeof item.admission?.featureIdentity?.semanticObjectId === "string");
        case "SCENARIO_IDENTITY":
            return evaluations.every((item) => (item.admission?.scenarioBindings.length ?? 0) > 0 && item.admission.scenarioBindings.every((binding) => typeof binding.semanticObjectId === "string"));
        case "ORDERED_STEPS":
            return evaluations.every((item) => (item.cases?.compiledCases.length ?? 0) > 0 && item.cases.compiledCases.every((gherkinCase) => Array.isArray(gherkinCase.steps) && gherkinCase.steps.length > 0));
        case "STEP_ARGUMENTS":
            return evaluations.some((item) => (item.cases?.compiledCases ?? []).some((gherkinCase) => Array.isArray(gherkinCase.steps) && gherkinCase.steps.some((step) => step.argument !== undefined)));
        case "COMMENTS_AND_NARRATIVE":
            return evaluations.some((item) => item.parse.comments.length > 0 && typeof (item.parse.gherkinDocument?.feature?.description) === "string");
        case "DIALECT_AND_ADVANCED_CONSTRUCTS":
            return evaluations.some((item) => item.parse.source.declaredDialect !== "en") && evaluations.some((item) => item.admission?.disposition === "PROFILE_HELD");
        case "CONNECTOR_REFERENCES":
            return evaluations.every((item) => item.expectedProfileDisposition === "REJECTED" || (item.admission?.scenarioBindings.length ?? 0) > 0 && item.admission.scenarioBindings.every((binding) => {
                const owned = binding.ownerScopedIdentities;
                return owned !== undefined && Object.values(owned).every((identity) => typeof identity.semanticObjectId === "string");
            }));
        case "COMPILER_IDENTITIES":
            return evaluations.every((item) => item.parse.grammar.implementationId === GHERKIN_IMPLEMENTATION_ID && item.receipt !== null && item.receipt.compiler.authorityId === GHERKIN_COMPILER_AUTHORITY_ID && item.receipt.compiler.authorityDigest !== item.receipt.grammar.authorityDigest);
        case "AST_CASE_COMPILATION_DIGESTS":
            return evaluations.every((item) => item.expectedParseDisposition === "PARSE_REJECTED" || (item.parse.astDigest !== null && item.cases?.caseDigest !== null && canonicalGherkinDigest({ document: item.parse.gherkinDocument, comments: item.parse.comments }) === item.parse.astDigest && canonicalGherkinDigest({ cases: item.cases.compiledCases, lineage: item.cases.caseLineage }) === item.cases.caseDigest));
        case "TYPED_DIAGNOSTICS":
            return carrierCasesSatisfied && evaluations.every((item) => item.expectedDiagnosticCodes.length > 0);
        case "REORDERED_REPRODUCTION":
            return reproduced;
    }
}
function evaluateInvalidCarrierCases(manifest, fixtures, grammarAuthority) {
    const byId = new Map(fixtures.map((fixture) => [fixture.fixtureId, fixture]));
    const evaluations = manifest.invalidCarrierCases.map((carrierCase) => {
        const basis = byId.get(carrierCase.basisFixtureId);
        if (!basis)
            return { carrierCaseId: carrierCase.carrierCaseId, expected: carrierCase.expectedDiagnosticCode, actual: [], retainedCarrier: false };
        const request = {
            contractId: "canonical-gherkin-parse-request.v1",
            sourceRef: basis.sourceRef,
            sourceBytesBase64: basis.sourceBytesBase64,
            mediaType: basis.mediaType,
            declaredDialect: basis.declaredDialect,
            grammarBinding: {
                platformCapabilityId: "sda-canonical-gherkin-grammar.v1",
                providerAuthorityRef: grammarAuthority.authorityRef,
                providerAuthorityDigest: grammarAuthority.authorityDigest
            }
        };
        if (carrierCase.mutation === "NON_CANONICAL_BASE64")
            request.sourceBytesBase64 = "YQ";
        if (carrierCase.mutation === "INVALID_UTF8")
            request.sourceBytesBase64 = "/w==";
        if (carrierCase.mutation === "UNSUPPORTED_MEDIA_TYPE")
            request.mediaType = "text/plain";
        if (carrierCase.mutation === "UNSUPPORTED_DIALECT")
            request.declaredDialect = "not-a-dialect";
        if (carrierCase.mutation === "STALE_GRAMMAR_BINDING")
            request.grammarBinding.providerAuthorityDigest = `sha256:${"f".repeat(64)}`;
        const result = parseCanonicalGherkin(request, grammarAuthority);
        return {
            carrierCaseId: carrierCase.carrierCaseId,
            expected: carrierCase.expectedDiagnosticCode,
            actual: uniqueSorted(result.diagnostics.map((item) => item.code)),
            retainedCarrier: result.source.sourceBytesBase64 === request.sourceBytesBase64,
            disposition: result.disposition
        };
    });
    const requiredMutations = ["INVALID_UTF8", "NON_CANONICAL_BASE64", "STALE_GRAMMAR_BINDING", "UNSUPPORTED_DIALECT", "UNSUPPORTED_MEDIA_TYPE"];
    const exactMutationCoverage = JSON.stringify(uniqueSorted(manifest.invalidCarrierCases.map((item) => item.mutation))) === JSON.stringify(requiredMutations);
    return {
        satisfied: evaluations.length === requiredMutations.length && exactMutationCoverage && evaluations.every((item) => item.disposition === "REJECTED" && item.retainedCarrier && item.actual.includes(item.expected)),
        evidenceDigests: uniqueSorted(evaluations.map((item) => canonicalGherkinDigest(item)))
    };
}
function evaluateReorderedDiscovery(manifest, fixtures, request, authorities) {
    const byId = new Map(fixtures.map((fixture) => [fixture.fixtureId, fixture]));
    const results = manifest.reproductionSets.map((set) => {
        const declaredIds = uniqueSorted(set.fixtureIds);
        const distinctOrders = uniqueSorted(set.discoveryOrders.map((order) => order.join("\u0000")));
        const orderEvaluations = set.discoveryOrders.map((order) => {
            const orderValid = JSON.stringify(uniqueSorted(order)) === JSON.stringify(declaredIds);
            const evaluated = order.flatMap((fixtureId) => {
                const fixture = byId.get(fixtureId);
                return fixture ? [evaluateFixture(fixture, request, authorities)] : [];
            });
            return {
                orderValid: orderValid && evaluated.length === declaredIds.length,
                normalizedDigest: canonicalGherkinDigest([...evaluated].sort((left, right) => left.fixtureId.localeCompare(right.fixtureId)))
            };
        });
        return {
            reproductionSetId: set.reproductionSetId,
            distinctOrders: distinctOrders.length >= 2,
            orderEvaluations,
            satisfied: distinctOrders.length >= 2 && orderEvaluations.every((item) => item.orderValid) && new Set(orderEvaluations.map((item) => item.normalizedDigest)).size === 1
        };
    });
    return {
        satisfied: results.length > 0 && results.every((item) => item.satisfied),
        evidenceDigests: uniqueSorted(results.map((item) => canonicalGherkinDigest(item)))
    };
}
/** Evaluates digest-bound authorities and fixtures repeatedly, producing the conformance capability receipt. */
export function verifyGherkinCompilerConformance(request, authorities, fixtureManifest, fixtures) {
    const findings = [];
    const required = new Set(request.requiredPartitions);
    if (request.contractId !== "gherkin-compiler-conformance-request.v1" || request.reproductionRuns < 2 || required.size !== PARTITIONS.length || PARTITIONS.some((partition) => !required.has(partition)))
        findings.push({ code: "INCOMPLETE_CONFORMANCE_REQUEST", subjectRef: "/", message: "All twelve unique partitions and at least two reproduction runs are required." });
    const compilerDigest = authorityDigest(authorities.compilerAuthority);
    const grammarDigest = authorityDigest(authorities.grammarAuthority);
    const profileDigest = canonicalGherkinDigest(authorities.profileAuthority);
    const fixtureSetDigest = canonicalGherkinDigest(withoutDigest(fixtureManifest, "fixtureSetDigest"));
    const authorityChecks = [
        ["STALE_COMPILER_AUTHORITY", isCurrentCompilerAuthority(authorities.compilerAuthority) && request.compilerAuthority.authorityRef === authorities.compilerAuthority.authorityRef && request.compilerAuthority.authorityId === authorities.compilerAuthority.authorityId && request.compilerAuthority.authorityDigest === compilerDigest],
        ["STALE_GRAMMAR_AUTHORITY", isCurrentGrammarAuthority(authorities.grammarAuthority) && request.grammarAuthority.authorityRef === authorities.grammarAuthority.authorityRef && request.grammarAuthority.authorityId === authorities.grammarAuthority.authorityId && request.grammarAuthority.authorityDigest === grammarDigest],
        ["STALE_PROFILE_AUTHORITY", isCurrentProfileAuthority(authorities.profileAuthority) && request.profileAuthority.authorityRef === SDA_GHERKIN_PROFILE_AUTHORITY_REF && request.profileAuthority.authorityId === authorities.profileAuthority.profileType && request.profileAuthority.authorityDigest === profileDigest],
        ["STALE_FIXTURE_CORPUS", request.fixtureCorpus.fixtureSetDigest === fixtureSetDigest && fixtureManifest.fixtureSetDigest === fixtureSetDigest]
    ];
    for (const [code, satisfied] of authorityChecks)
        if (!satisfied)
            findings.push({ code, subjectRef: request.fixtureCorpus.fixtureSetRef, message: `${code.replaceAll("_", " ")} does not name current content.` });
    const orderedFixtures = [...fixtures].sort((left, right) => left.fixtureId.localeCompare(right.fixtureId));
    const manifestById = new Map(fixtureManifest.fixtures.map((fixture) => [fixture.fixtureId, fixture]));
    const fixtureBindingsCurrent = orderedFixtures.length === fixtureManifest.fixtures.length && orderedFixtures.every((fixture) => {
        const manifested = manifestById.get(fixture.fixtureId);
        const bytes = strictBase64(fixture.sourceBytesBase64);
        return manifested !== undefined && bytes !== null && digestBytes(bytes) === manifested.sourceDigest &&
            fixture.sourceDigest === manifested.sourceDigest && fixture.mediaType === manifested.mediaType && fixture.declaredDialect === manifested.declaredDialect &&
            fixture.path === manifested.path &&
            canonicalGherkinDigest(fixture.expectedProofPartitions) === canonicalGherkinDigest(manifested.expectedProofPartitions) &&
            fixture.expectedParseDisposition === manifested.expectedParseDisposition && fixture.expectedProfileDisposition === manifested.expectedProfileDisposition &&
            canonicalGherkinDigest(fixture.expectedDiagnosticCodes) === canonicalGherkinDigest(manifested.expectedDiagnosticCodes);
    });
    const actualFixtureDigests = uniqueSorted(orderedFixtures.map((fixture) => {
        const bytes = strictBase64(fixture.sourceBytesBase64);
        return bytes === null ? canonicalGherkinDigest(fixture.sourceBytesBase64) : digestBytes(bytes);
    }));
    const requestedFixtureDigests = uniqueSorted(request.fixtureCorpus.fixtureDigests);
    const manifestedFixtureDigests = uniqueSorted(fixtureManifest.fixtures.map((fixture) => fixture.sourceDigest));
    const fixtureDigestsCurrent = fixtureBindingsCurrent && request.fixtureCorpus.fixtureDigests.length === fixtureManifest.fixtures.length && JSON.stringify(actualFixtureDigests) === JSON.stringify(requestedFixtureDigests) && JSON.stringify(actualFixtureDigests) === JSON.stringify(manifestedFixtureDigests);
    if (!fixtureDigestsCurrent)
        findings.push({ code: "STALE_FIXTURE_DIGESTS", subjectRef: request.fixtureCorpus.fixtureSetRef, message: "Fixture identities, bytes, media types, dialects, expectations, manifest digests, and request digests are not mutually current." });
    const requiredMediaTypes = ["text/x.cucumber.gherkin+markdown", "text/x.cucumber.gherkin+plain"];
    const mediaTypeCoverageCurrent = JSON.stringify(uniqueSorted(fixtureManifest.fixtures.map((fixture) => fixture.mediaType))) === JSON.stringify(requiredMediaTypes) &&
        JSON.stringify(uniqueSorted(orderedFixtures.map((fixture) => fixture.mediaType))) === JSON.stringify(requiredMediaTypes);
    if (!mediaTypeCoverageCurrent)
        findings.push({ code: "INCOMPLETE_MEDIA_TYPE_COVERAGE", subjectRef: request.fixtureCorpus.fixtureSetRef, message: "The conformance corpus must retain both canonical plain and Markdown Gherkin fixtures." });
    const runs = Array.from({ length: Math.max(0, request.reproductionRuns) }, () => orderedFixtures.map((fixture) => evaluateFixture(fixture, request, authorities)));
    const reproduced = runs.length >= 2 && runs.every((run) => canonicalGherkinDigest(run) === canonicalGherkinDigest(runs[0] ?? []));
    if (!reproduced)
        findings.push({ code: "REPRODUCTION_MISMATCH", subjectRef: request.fixtureCorpus.fixtureSetRef, message: "Fixture evaluation changed across identical runs." });
    const carrierCases = evaluateInvalidCarrierCases(fixtureManifest, orderedFixtures, authorities.grammarAuthority);
    if (!carrierCases.satisfied)
        findings.push({ code: "INVALID_CARRIER_EXPECTATION_MISMATCH", subjectRef: request.fixtureCorpus.fixtureSetRef, message: "One or more invalid source carriers did not produce the declared typed rejection." });
    const reordered = evaluateReorderedDiscovery(fixtureManifest, orderedFixtures, request, authorities);
    if (!reordered.satisfied)
        findings.push({ code: "REPRODUCTION_MISMATCH", subjectRef: "REORDERED_REPRODUCTION", message: "Declared discovery orders did not normalize to identical fixture results." });
    const firstRun = runs[0] ?? [];
    const authoritiesCurrent = authorityChecks.slice(0, 3).every(([, satisfied]) => satisfied);
    const partitions = PARTITIONS.map((partition) => {
        const relevant = firstRun.filter((item) => item.expectedProofPartitions.includes(partition));
        const observable = required.has(partition) && relevant.length > 0;
        const subjectCurrent = partition === "COMPILER_IDENTITIES" ? authoritiesCurrent : partition === "EXACT_BYTES" ? fixtureDigestsCurrent && mediaTypeCoverageCurrent : true;
        const satisfied = subjectCurrent && partitionSatisfied(partition, relevant, reproduced && reordered.satisfied, carrierCases.satisfied);
        const disposition = !observable ? "NOT_OBSERVABLE" : satisfied ? "SATISFIED" : "NOT_SATISFIED";
        if (required.has(partition) && !observable)
            findings.push({ code: "MISSING_PROOF_PARTITION", subjectRef: partition, message: `No fixture observes required partition ${partition}.` });
        if (disposition === "NOT_SATISFIED")
            findings.push({ code: "FIXTURE_EXPECTATION_MISMATCH", subjectRef: partition, message: `Observed fixture evidence did not satisfy partition ${partition}.` });
        const supplemental = partition === "TYPED_DIAGNOSTICS" ? carrierCases.evidenceDigests : partition === "REORDERED_REPRODUCTION" ? reordered.evidenceDigests : [];
        return { partitionId: partition, disposition, evidenceDigests: uniqueSorted([...relevant.map((item) => canonicalGherkinDigest(item)), ...supplemental]) };
    });
    const stale = findings.some((entry) => entry.code.startsWith("STALE_") || entry.code === "REPRODUCTION_MISMATCH" || entry.code === "FIXTURE_EXPECTATION_MISMATCH" || entry.code === "INVALID_CARRIER_EXPECTATION_MISMATCH" || entry.code === "INCOMPLETE_MEDIA_TYPE_COVERAGE");
    const disposition = findings.length === 0 && partitions.every((partition) => partition.disposition === "SATISFIED")
        ? "GHERKIN_SEMANTIC_INGESTION_CONFORMANT"
        : stale ? "GHERKIN_SEMANTIC_INGESTION_REJECTED" : "GHERKIN_SEMANTIC_INGESTION_OPEN";
    const draft = { contractId: "gherkin-semantic-ingestion-conformance.v1", compilerDigest: request.compilerAuthority.authorityDigest, grammarDigest: request.grammarAuthority.authorityDigest, profileDigest: request.profileAuthority.authorityDigest, fixtureSetDigest: request.fixtureCorpus.fixtureSetDigest, partitions, findings, disposition };
    return { ...draft, receiptDigest: canonicalGherkinDigest(draft) };
}
