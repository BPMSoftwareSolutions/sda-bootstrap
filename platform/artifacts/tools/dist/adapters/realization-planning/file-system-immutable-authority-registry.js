import fs from "node:fs";
import path from "node:path";
import { sha256Digest } from "../../enterprise/control-plane/canonical-json.js";
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SCHEMA_BY_AUTHORITY_KIND = Object.freeze({
    INTENT: "intent-authority.schema.json",
    CAPABILITY_REGISTRATION: "capability-registration.schema.json",
    REALIZATION_POLICY: "realization-policy.schema.json",
    ENVIRONMENT_PROFILE: "environment-profile.schema.json",
    CAPABILITY_GRAPH: "capability-graph-authority.schema.json",
    PROVIDER_CATALOG: "provider-catalog-snapshot.schema.json",
    PLANNING_SNAPSHOT: "planning-authority-snapshot.schema.json",
    POLICY_DECISION_PROFILE: "realization-policy-decision-profile.schema.json",
    PROJECTOR_PROFILE: "realization-projector-profile.schema.json"
});
function freezeDeep(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value))
        return value;
    for (const member of Object.values(value))
        freezeDeep(member);
    return Object.freeze(value);
}
function selectorKey(authorityId, selector) {
    return `${authorityId}\u0000${selector}`;
}
function withoutDigest(value, digestField) {
    const result = { ...value };
    delete result[digestField];
    return result;
}
function resolveSafeRegularFile(root, relativeRef) {
    if (path.isAbsolute(relativeRef) || relativeRef.includes("\\")) {
        throw new Error(`Registry document reference '${relativeRef}' is not a portable relative path.`);
    }
    const segments = relativeRef.split("/");
    if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
        throw new Error(`Registry document reference '${relativeRef}' escapes its registry root.`);
    }
    const resolved = path.resolve(root, ...segments);
    const relative = path.relative(root, resolved);
    if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
        throw new Error(`Registry document reference '${relativeRef}' escapes its registry root.`);
    }
    const status = fs.lstatSync(resolved);
    if (status.isSymbolicLink() || !status.isFile()) {
        throw new Error(`Registry document reference '${relativeRef}' is not a regular file.`);
    }
    const realRoot = fs.realpathSync(root);
    const realFile = fs.realpathSync(resolved);
    const realRelative = path.relative(realRoot, realFile);
    if (realRelative.startsWith(`..${path.sep}`) || realRelative === ".." || path.isAbsolute(realRelative)) {
        throw new Error(`Registry document reference '${relativeRef}' resolves outside its registry root.`);
    }
    return realFile;
}
function decodePointerToken(token) {
    if (/~(?:[^01]|$)/.test(token))
        throw new Error(`Registry JSON Pointer token '${token}' has an invalid escape.`);
    return token.replace(/~1/g, "/").replace(/~0/g, "~");
}
function valueAtPointer(document, pointer) {
    if (!pointer.startsWith("/"))
        throw new Error(`Registry JSON Pointer '${pointer}' must start with '/'.`);
    let current = document;
    for (const encodedToken of pointer.slice(1).split("/")) {
        const token = decodePointerToken(encodedToken);
        if (Array.isArray(current)) {
            if (!/^(?:0|[1-9][0-9]*)$/.test(token))
                throw new Error(`Registry JSON Pointer '${pointer}' has an invalid array index.`);
            const index = Number(token);
            if (index >= current.length)
                throw new Error(`Registry JSON Pointer '${pointer}' does not resolve.`);
            current = current[index];
        }
        else if (current && typeof current === "object" && Object.hasOwn(current, token)) {
            current = current[token];
        }
        else {
            throw new Error(`Registry JSON Pointer '${pointer}' does not resolve.`);
        }
    }
    return current;
}
function parseJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Registry JSON '${path.basename(filePath)}' could not be parsed: ${message}`);
    }
}
export class FileSystemImmutableAuthorityRegistry {
    manifestDigest;
    valuesByDigest = new Map();
    digestByAlias = new Map();
    constructor(options) {
        const root = fs.realpathSync(options.registryRoot);
        const manifestPath = resolveSafeRegularFile(root, options.manifestRef);
        const manifestValue = parseJson(manifestPath);
        const admission = options.schemaAdmission.validate(manifestValue, "file-authority-registry-manifest.schema.json");
        if (!admission.valid) {
            throw new Error(`Registry manifest admission failed: ${admission.errors.map((error) => `${error.instancePath} ${error.message}`).join("; ")}`);
        }
        const manifest = manifestValue;
        const expectedManifestDigest = sha256Digest(withoutDigest(manifest, "registryDigest"));
        if (manifest.registryDigest !== expectedManifestDigest)
            throw new Error("Registry manifest failed digest verification.");
        this.manifestDigest = manifest.registryDigest;
        const documentCache = new Map();
        const entries = manifest.entries.filter((entry) => entry.authorityKind === options.authorityKind);
        if (entries.length === 0)
            throw new Error(`Registry manifest has no '${options.authorityKind}' authority.`);
        for (const entry of entries) {
            if (entry.schemaFilename !== SCHEMA_BY_AUTHORITY_KIND[entry.authorityKind]) {
                throw new Error(`Authority '${entry.authorityId}' does not use the trusted schema for '${entry.authorityKind}'.`);
            }
            if (!DIGEST_PATTERN.test(entry.authorityDigest) || !DIGEST_PATTERN.test(entry.documentDigest)) {
                throw new Error(`Authority '${entry.authorityId}' has an invalid digest.`);
            }
            const documentPath = resolveSafeRegularFile(root, entry.documentRef);
            let document = documentCache.get(documentPath);
            if (document === undefined) {
                document = parseJson(documentPath);
                documentCache.set(documentPath, document);
            }
            const selected = valueAtPointer(document, entry.documentPointer);
            if (sha256Digest(selected) !== entry.documentDigest) {
                throw new Error(`Authority '${entry.authorityId}' document digest is stale.`);
            }
            const selectedAdmission = options.schemaAdmission.validate(selected, entry.schemaFilename);
            if (!selectedAdmission.valid) {
                throw new Error(`Authority '${entry.authorityId}' failed '${entry.schemaFilename}' admission.`);
            }
            const value = selected;
            if (!options.verifyAuthority(value, entry.authorityDigest, entry.authorityId)) {
                throw new Error(`Authority '${entry.authorityId}' failed identity or authority-digest verification.`);
            }
            const digestKey = selectorKey(entry.authorityId, entry.authorityDigest);
            if (this.valuesByDigest.has(digestKey)) {
                throw new Error(`Authority '${entry.authorityId}' declares digest '${entry.authorityDigest}' more than once.`);
            }
            this.valuesByDigest.set(digestKey, freezeDeep(structuredClone(value)));
            for (const alias of entry.aliases) {
                if (alias.length === 0 || DIGEST_PATTERN.test(alias))
                    throw new Error(`Authority '${entry.authorityId}' has invalid alias '${alias}'.`);
                const aliasKey = selectorKey(entry.authorityId, alias);
                if (this.digestByAlias.has(aliasKey))
                    throw new Error(`Authority alias '${entry.authorityId}:${alias}' is ambiguous.`);
                this.digestByAlias.set(aliasKey, entry.authorityDigest);
            }
        }
    }
    resolve(authorityId, selector) {
        const exact = this.valuesByDigest.get(selectorKey(authorityId, selector));
        if (exact)
            return Object.freeze({ authorityId, selector, digest: selector, resolvedBy: "DIGEST", value: exact });
        const digest = this.digestByAlias.get(selectorKey(authorityId, selector));
        if (!digest)
            return null;
        const value = this.valuesByDigest.get(selectorKey(authorityId, digest));
        if (!value)
            throw new Error(`Authority alias '${authorityId}:${selector}' has no immutable value.`);
        return Object.freeze({ authorityId, selector, digest, resolvedBy: "ALIAS", value });
    }
}
