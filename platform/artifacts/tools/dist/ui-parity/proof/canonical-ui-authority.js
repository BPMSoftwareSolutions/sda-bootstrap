import fs from "node:fs";
import path from "node:path";
import { sha256 } from "../../primitives/sha256.js";
import { canonicalize } from "../../consumer-projection/proof/projection-equivalence-observer.js";
export function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
}
export function canonicalDigest(value) {
    return sha256(canonicalJson(value));
}
export function createUiAuthorityIdentity(authorityRef, authority) {
    if (authority.uiAuthorityType !== "consumer-ui-authority.v1" || typeof authority.applicationId !== "string") {
        throw new Error("UI authority identity requires an admitted consumer-ui-authority.v1 document.");
    }
    const experience = authority.experienceAuthority;
    const conditions = Array.isArray(experience?.conditions) ? experience.conditions : [];
    const experienceConditionIds = conditions.map((condition) => String(condition.conditionId));
    if (experienceConditionIds.length === 0)
        throw new Error("UI authority identity requires declared experience conditions.");
    return Object.freeze({
        identityType: "consumer-ui-authority-identity.v1",
        authorityRef,
        uiAuthorityType: "consumer-ui-authority.v1",
        applicationId: authority.applicationId,
        experienceConditionIds: Object.freeze(experienceConditionIds),
        canonicalization: "recursive-key-order.v1",
        authorityDigest: canonicalDigest(authority)
    });
}
export function assertFrozenUiAuthority(identity, authorityRef, authority) {
    const observed = createUiAuthorityIdentity(authorityRef, authority);
    if (canonicalJson(identity) !== canonicalJson(observed)) {
        throw new Error(`UI_AUTHORITY_DIGEST_DIVERGENCE: expected '${identity.authorityDigest}' observed '${observed.authorityDigest}'.`);
    }
}
function readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}
export function loadUiParityWorkspace(workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    const workspace = readJson(path.join(root, "consumer-workspace.authority.json"));
    const declarations = Array.isArray(workspace.capabilities) ? workspace.capabilities : [];
    const declaration = declarations[0];
    if (!declaration || typeof declaration.interfaces !== "string")
        throw new Error("UI parity requires one consumer capability interface authority.");
    const interfaceAuthority = readJson(path.resolve(root, declaration.interfaces));
    const interfaces = Array.isArray(interfaceAuthority.interfaces) ? interfaceAuthority.interfaces : [];
    const binding = interfaces.find((candidate) => candidate.kind === "ui");
    const configuration = binding?.configuration;
    if (!configuration || typeof configuration.authorityRef !== "string" || typeof configuration.vectorRef !== "string") {
        throw new Error("UI parity requires a UI binding with authorityRef and vectorRef.");
    }
    const authorityRef = configuration.authorityRef;
    const vectorRef = configuration.vectorRef;
    const coverageRef = vectorRef.endsWith(".vectors.json")
        ? vectorRef.replace(/\.vectors\.json$/u, ".experience-coverage.json")
        : vectorRef.replace(/-vectors\.json$/u, "-experience-coverage.json");
    if (coverageRef === vectorRef)
        throw new Error(`UI vector reference '${vectorRef}' cannot resolve an experience-coverage authority by convention.`);
    const authorityPath = path.resolve(root, authorityRef);
    const vectorPath = path.resolve(root, vectorRef);
    const coveragePath = path.resolve(root, coverageRef);
    const identityPath = authorityPath.replace(/\.json$/u, ".identity.json");
    const authority = readJson(authorityPath);
    const identity = readJson(identityPath);
    const vectors = readJson(vectorPath);
    const coverage = readJson(coveragePath);
    assertFrozenUiAuthority(identity, authorityRef, authority);
    if (vectors.authorityIdentity.authorityRef !== authorityRef || vectors.authorityIdentity.authorityDigest !== identity.authorityDigest) {
        throw new Error("VECTOR_CORPUS_AUTHORITY_DIVERGENCE: the vector corpus is not bound to the frozen UI authority.");
    }
    if (coverage.authorityDigest !== identity.authorityDigest || coverage.vectorCorpusDigest !== canonicalDigest(vectors)) {
        throw new Error("EXPERIENCE_COVERAGE_DIGEST_DIVERGENCE: experience coverage is not bound to the frozen authority and vector corpus.");
    }
    return Object.freeze({ authorityPath, authorityRef, authority, identityPath, identity, vectorPath, vectorRef, vectors, coveragePath, coverageRef, coverage });
}
